create function lozzi_private.grade_code_for_total(p_total numeric)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when p_total >= 93 then 'A'
    when p_total >= 90 then 'A-'
    when p_total >= 87 then 'B+'
    when p_total >= 83 then 'B'
    when p_total >= 80 then 'B-'
    when p_total >= 77 then 'C+'
    when p_total >= 73 then 'C'
    when p_total >= 70 then 'C-'
    when p_total >= 67 then 'D+'
    when p_total >= 63 then 'D'
    when p_total >= 60 then 'D-'
    else 'F'
  end
$$;

create function lozzi_private.grade_points_for_code(p_grade_code text)
returns numeric
language sql
immutable
strict
set search_path = ''
as $$
  select case p_grade_code
    when 'A' then 4.00
    when 'A-' then 3.70
    when 'B+' then 3.30
    when 'B' then 3.00
    when 'B-' then 2.70
    when 'C+' then 2.30
    when 'C' then 2.00
    when 'C-' then 1.70
    when 'D+' then 1.30
    when 'D' then 1.00
    when 'D-' then 0.70
    else 0.00
  end
$$;

create function lozzi_private.begin_idempotent_operation(
  p_institution_id uuid,
  p_operation text,
  p_idempotency_key uuid,
  p_request jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  key_digest bytea;
  request_digest bytea;
  stored public.idempotency_keys%rowtype;
begin
  if p_institution_id is null
    or p_operation is null
    or p_idempotency_key is null
    or p_request is null
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid idempotency boundary';
  end if;

  key_digest := extensions.digest(p_idempotency_key::text, 'sha256');
  request_digest := extensions.digest(p_request::text, 'sha256');

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_institution_id::text || ':' || p_operation || ':' || p_idempotency_key::text,
      0
    )
  );

  select request.*
  into stored
  from public.idempotency_keys request
  where request.institution_id = p_institution_id
    and request.operation = p_operation
    and request.key_hash = key_digest
  for update;

  if stored.id is not null then
    if stored.request_commitment <> request_digest then
      raise exception using
        errcode = '22023',
        message = 'Idempotency key was already used for a different request';
    end if;

    if stored.status = 'completed' then
      return coalesce(stored.result, '{}'::jsonb)
        || jsonb_build_object('idempotentReplay', true);
    end if;

    raise exception using
      errcode = '40001',
      message = 'The matching operation is still processing';
  end if;

  insert into public.idempotency_keys (
    institution_id,
    operation,
    key_hash,
    request_commitment,
    status,
    expires_at
  )
  values (
    p_institution_id,
    p_operation,
    key_digest,
    request_digest,
    'processing',
    now() + interval '24 hours'
  );

  return null;
end;
$$;

create function lozzi_private.complete_idempotent_operation(
  p_institution_id uuid,
  p_operation text,
  p_idempotency_key uuid,
  p_result_reference uuid,
  p_result jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.idempotency_keys request
  set
    result_reference = p_result_reference,
    result = p_result,
    status = 'completed'
  where request.institution_id = p_institution_id
    and request.operation = p_operation
    and request.key_hash = extensions.digest(p_idempotency_key::text, 'sha256')
    and request.status = 'processing';

  if not found then
    raise exception using
      errcode = '40001',
      message = 'Idempotency operation could not be completed';
  end if;
end;
$$;

create function lozzi_private.refresh_degree_audit(
  p_student_id uuid,
  p_academic_record_version_id uuid,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_student public.students%rowtype;
  target_program public.student_programs%rowtype;
  required_credits numeric(6,2);
  earned_credits numeric(6,2);
  calculated_gpa numeric(4,2);
  requirement_results jsonb;
  snapshot_id uuid;
begin
  select student.*
  into target_student
  from public.students student
  where student.id = p_student_id
    and student.deactivated_at is null;

  select student_program.*
  into target_program
  from public.student_programs student_program
  where student_program.student_id = p_student_id
    and student_program.status = 'active'
  order by student_program.assigned_at desc
  limit 1;

  if target_student.id is null or target_program.id is null then
    raise exception using
      errcode = '23503',
      message = 'Student program is required for degree audit';
  end if;

  select program_version.required_credits
  into required_credits
  from public.program_versions program_version
  where program_version.id = target_program.program_version_id;

  select
    coalesce(sum(record.credit_hours_earned), 0),
    round(
      (
        sum(record.grade_points * enrollment.credit_hours)
        / nullif(sum(enrollment.credit_hours), 0)
      )::numeric,
      2
    )
  into earned_credits, calculated_gpa
  from public.grade_records record
  join public.enrollments enrollment
    on enrollment.id = record.enrollment_id
  where enrollment.student_id = p_student_id
    and record.is_current;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'requirementId', requirement.id,
        'group', requirement.requirement_group,
        'courseId', course.id,
        'code', course.code,
        'title', course.title,
        'credits', requirement.minimum_credits,
        'status', case
          when coalesce(completion.passed, false) then 'complete'
          when coalesce(in_progress.active, false) then 'in-progress'
          else 'remaining'
        end
      )
      order by requirement.sort_order, course.code
    ),
    '[]'::jsonb
  )
  into requirement_results
  from public.program_requirements requirement
  join public.courses course on course.id = requirement.course_id
  left join lateral (
    select true as passed
    from public.grade_records record
    join public.enrollments enrollment
      on enrollment.id = record.enrollment_id
    join public.course_sections section
      on section.id = enrollment.section_id
    where enrollment.student_id = p_student_id
      and section.course_id = requirement.course_id
      and record.is_current
      and record.credit_hours_earned > 0
    limit 1
  ) completion on true
  left join lateral (
    select true as active
    from public.enrollments enrollment
    join public.course_sections section
      on section.id = enrollment.section_id
    where enrollment.student_id = p_student_id
      and section.course_id = requirement.course_id
      and enrollment.status = 'enrolled'
    limit 1
  ) in_progress on true
  where requirement.program_version_id = target_program.program_version_id;

  insert into public.degree_audit_snapshots (
    institution_id,
    student_id,
    student_program_id,
    academic_record_version_id,
    credits_earned,
    credits_required,
    gpa,
    progress_percent,
    requirement_results,
    created_by
  )
  values (
    target_student.institution_id,
    p_student_id,
    target_program.id,
    p_academic_record_version_id,
    earned_credits,
    required_credits,
    calculated_gpa,
    least(round((earned_credits / required_credits) * 100, 2), 100),
    requirement_results,
    p_actor_user_id
  )
  returning id into snapshot_id;

  return snapshot_id;
end;
$$;

create function public.save_grade_drafts(
  p_section_id uuid,
  p_grades jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_section public.course_sections%rowtype;
  grade_item jsonb;
  target_enrollment public.enrollments%rowtype;
  working_submission public.grade_submissions%rowtype;
  v_enrollment_id uuid;
  v_participation numeric(5,2);
  v_assignment_average numeric(5,2);
  v_final_exam numeric(5,2);
  v_total numeric(5,2);
  v_grade_code text;
  v_grade_points numeric(4,2);
  complete_count integer := 0;
  saved_count integer := 0;
  replay_result jsonb;
  result_payload jsonb;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_section_id is null
    or p_idempotency_key is null
    or jsonb_typeof(p_grades) <> 'array'
    or jsonb_array_length(p_grades) not between 1 and 100
  then
    raise exception using errcode = '22023', message = 'Invalid grade draft request';
  end if;

  select section.*
  into target_section
  from public.course_sections section
  where section.id = p_section_id
    and section.deactivated_at is null;

  if target_section.id is null
    or not lozzi_private.is_section_instructor(target_section.id)
  then
    raise exception using errcode = '42501', message = 'Assigned instructor access required';
  end if;

  if (
    select count(*)
    from (
      select distinct item ->> 'enrollmentId'
      from jsonb_array_elements(p_grades) item
    ) distinct_enrollments
  ) <> jsonb_array_length(p_grades) then
    raise exception using errcode = '22023', message = 'Duplicate enrollment grade';
  end if;

  replay_result := lozzi_private.begin_idempotent_operation(
    target_section.institution_id,
    'grade.draft.save',
    p_idempotency_key,
    jsonb_build_object('sectionId', p_section_id, 'grades', p_grades)
  );

  if replay_result is not null then
    return replay_result;
  end if;

  for grade_item in
    select item
    from jsonb_array_elements(p_grades) item
  loop
    begin
      v_enrollment_id := (grade_item ->> 'enrollmentId')::uuid;
      v_participation := nullif(grade_item ->> 'participationScore', '')::numeric;
      v_assignment_average := nullif(grade_item ->> 'assignmentAverage', '')::numeric;
      v_final_exam := nullif(grade_item ->> 'finalExamScore', '')::numeric;
    exception
      when others then
        raise exception using errcode = '22023', message = 'Invalid grade value';
    end;

    if v_participation is not null and v_participation not between 0 and 10
      or v_assignment_average is not null and v_assignment_average not between 0 and 100
      or v_final_exam is not null and v_final_exam not between 0 and 100
    then
      raise exception using errcode = '22023', message = 'Grade value is outside its allowed range';
    end if;

    select enrollment.*
    into target_enrollment
    from public.enrollments enrollment
    where enrollment.id = v_enrollment_id
      and enrollment.section_id = p_section_id
      and enrollment.institution_id = target_section.institution_id
      and enrollment.status in ('enrolled', 'completed')
    for update;

    if target_enrollment.id is null then
      raise exception using errcode = '22023', message = 'Enrollment is not in the assigned roster';
    end if;

    select submission.*
    into working_submission
    from public.grade_submissions submission
    where submission.enrollment_id = v_enrollment_id
      and submission.state in ('draft', 'submitted', 'approved')
    for update;

    if working_submission.id is not null and working_submission.state <> 'draft' then
      raise exception using errcode = '55000', message = 'Submitted grades are read-only';
    end if;

    if working_submission.id is null and exists (
      select 1
      from public.grade_records record
      where record.enrollment_id = v_enrollment_id
        and record.is_current
    ) then
      raise exception using errcode = '55000', message = 'Start a correction before editing a published grade';
    end if;

    if v_participation is not null
      and v_assignment_average is not null
      and v_final_exam is not null
    then
      v_total := round(
        v_participation
          + (v_assignment_average * 0.40)
          + (v_final_exam * 0.50),
        2
      );
      v_grade_code := lozzi_private.grade_code_for_total(v_total);
      v_grade_points := lozzi_private.grade_points_for_code(v_grade_code);
      complete_count := complete_count + 1;
    else
      v_total := null;
      v_grade_code := null;
      v_grade_points := null;
    end if;

    if working_submission.id is null then
      insert into public.grade_submissions (
        institution_id,
        enrollment_id,
        submitted_by,
        state,
        grade_code,
        grade_points,
        participation_score,
        assignment_average,
        final_exam_score,
        total_score,
        idempotency_key,
        created_by,
        updated_by
      )
      values (
        target_section.institution_id,
        v_enrollment_id,
        caller_id,
        'draft',
        v_grade_code,
        v_grade_points,
        v_participation,
        v_assignment_average,
        v_final_exam,
        v_total,
        gen_random_uuid(),
        caller_id,
        caller_id
      );
    else
      update public.grade_submissions submission
      set
        grade_code = v_grade_code,
        grade_points = v_grade_points,
        participation_score = v_participation,
        assignment_average = v_assignment_average,
        final_exam_score = v_final_exam,
        total_score = v_total,
        draft_revision = submission.draft_revision + 1,
        updated_at = now(),
        updated_by = caller_id
      where submission.id = working_submission.id;
    end if;

    saved_count := saved_count + 1;
    target_enrollment := null;
    working_submission := null;
  end loop;

  result_payload := jsonb_build_object(
    'success', true,
    'sectionId', p_section_id,
    'state', 'draft',
    'savedCount', saved_count,
    'completeCount', complete_count,
    'message', 'Draft grades saved.'
  );

  perform lozzi_private.complete_idempotent_operation(
    target_section.institution_id,
    'grade.draft.save',
    p_idempotency_key,
    p_section_id,
    result_payload
  );

  insert into public.audit_events (
    institution_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    outcome,
    metadata
  )
  values (
    target_section.institution_id,
    caller_id,
    'grade.draft.save',
    'course_section',
    p_section_id,
    'success',
    jsonb_build_object(
      'savedCount', saved_count,
      'completeCount', complete_count
    )
  );

  return result_payload;
end;
$$;

create function public.submit_section_grades(
  p_section_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_section public.course_sections%rowtype;
  required_count integer;
  complete_count integer;
  submission_count integer;
  replay_result jsonb;
  result_payload jsonb;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select section.*
  into target_section
  from public.course_sections section
  where section.id = p_section_id
    and section.deactivated_at is null
  for update;

  if target_section.id is null
    or not lozzi_private.is_section_instructor(target_section.id)
  then
    raise exception using errcode = '42501', message = 'Assigned instructor access required';
  end if;

  replay_result := lozzi_private.begin_idempotent_operation(
    target_section.institution_id,
    'grade.section.submit',
    p_idempotency_key,
    jsonb_build_object('sectionId', p_section_id)
  );

  if replay_result is not null then
    return replay_result;
  end if;

  select count(*)
  into required_count
  from public.enrollments enrollment
  where enrollment.section_id = p_section_id
    and enrollment.status in ('enrolled', 'completed')
    and not exists (
      select 1
      from public.grade_records record
      where record.enrollment_id = enrollment.id
        and record.is_current
    );

  select count(*)
  into complete_count
  from public.grade_submissions submission
  join public.enrollments enrollment
    on enrollment.id = submission.enrollment_id
  where enrollment.section_id = p_section_id
    and submission.state = 'draft'
    and submission.participation_score is not null
    and submission.assignment_average is not null
    and submission.final_exam_score is not null
    and submission.total_score is not null
    and submission.grade_code is not null
    and submission.grade_points is not null;

  if complete_count = 0 or complete_count < required_count then
    raise exception using
      errcode = '23514',
      message = 'Every unpublished roster grade must be complete before submission';
  end if;

  update public.grade_submissions submission
  set
    state = 'submitted',
    submitted_by = caller_id,
    submitted_at = now(),
    updated_at = now(),
    updated_by = caller_id
  from public.enrollments enrollment
  where enrollment.id = submission.enrollment_id
    and enrollment.section_id = p_section_id
    and submission.state = 'draft';

  get diagnostics submission_count = row_count;

  result_payload := jsonb_build_object(
    'success', true,
    'sectionId', p_section_id,
    'state', 'submitted',
    'submittedCount', submission_count,
    'message', 'Grades submitted for registrar review.'
  );

  perform lozzi_private.complete_idempotent_operation(
    target_section.institution_id,
    'grade.section.submit',
    p_idempotency_key,
    p_section_id,
    result_payload
  );

  insert into public.audit_events (
    institution_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    outcome,
    metadata
  )
  values (
    target_section.institution_id,
    caller_id,
    'grade.section.submit',
    'course_section',
    p_section_id,
    'success',
    jsonb_build_object('submissionCount', submission_count)
  );

  return result_payload;
end;
$$;

create function public.approve_grade_submission(
  p_grade_submission_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_submission public.grade_submissions%rowtype;
  replay_result jsonb;
  result_payload jsonb;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select submission.*
  into target_submission
  from public.grade_submissions submission
  where submission.id = p_grade_submission_id
  for update;

  if target_submission.id is null then
    raise exception using errcode = '22023', message = 'Grade submission not found';
  end if;

  if not lozzi_private.has_membership(
    target_submission.institution_id,
    array['registrar', 'institution_admin']
  ) then
    raise exception using errcode = '42501', message = 'Registrar access required';
  end if;

  replay_result := lozzi_private.begin_idempotent_operation(
    target_submission.institution_id,
    'grade.submission.approve',
    p_idempotency_key,
    jsonb_build_object('gradeSubmissionId', p_grade_submission_id)
  );

  if replay_result is not null then
    return replay_result;
  end if;

  if target_submission.state <> 'submitted' then
    raise exception using
      errcode = '55000',
      message = 'Only submitted grades can be approved';
  end if;

  update public.grade_submissions submission
  set
    state = 'approved',
    approved_by = caller_id,
    approved_at = now(),
    updated_at = now(),
    updated_by = caller_id
  where submission.id = p_grade_submission_id;

  result_payload := jsonb_build_object(
    'success', true,
    'gradeSubmissionId', p_grade_submission_id,
    'state', 'approved',
    'message', 'Grade approved.'
  );

  perform lozzi_private.complete_idempotent_operation(
    target_submission.institution_id,
    'grade.submission.approve',
    p_idempotency_key,
    p_grade_submission_id,
    result_payload
  );

  insert into public.audit_events (
    institution_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    outcome,
    metadata
  )
  values (
    target_submission.institution_id,
    caller_id,
    'grade.submission.approve',
    'grade_submission',
    p_grade_submission_id,
    'success',
    jsonb_build_object(
      'isCorrection',
      target_submission.previous_grade_submission_id is not null
    )
  );

  return result_payload;
end;
$$;

create function public.publish_grade_submission(
  p_grade_submission_id uuid,
  p_content_commitment bytea,
  p_salt_reference text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_submission public.grade_submissions%rowtype;
  target_enrollment public.enrollments%rowtype;
  previous_record public.grade_records%rowtype;
  previous_academic_version public.academic_record_versions%rowtype;
  grade_record_id uuid;
  academic_record_version_id uuid;
  degree_audit_snapshot_id uuid;
  next_grade_version integer;
  next_academic_version integer;
  replay_result jsonb;
  result_payload jsonb;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_content_commitment is null
    or octet_length(p_content_commitment) <> 32
    or p_salt_reference is null
    or length(trim(p_salt_reference)) not between 8 and 200
  then
    raise exception using errcode = '22023', message = 'Invalid record commitment';
  end if;

  select submission.*
  into target_submission
  from public.grade_submissions submission
  where submission.id = p_grade_submission_id
  for update;

  if target_submission.id is null then
    raise exception using errcode = '22023', message = 'Grade submission not found';
  end if;

  if not lozzi_private.has_membership(
    target_submission.institution_id,
    array['registrar', 'institution_admin']
  ) then
    raise exception using errcode = '42501', message = 'Registrar access required';
  end if;

  replay_result := lozzi_private.begin_idempotent_operation(
    target_submission.institution_id,
    'grade.submission.publish',
    p_idempotency_key,
    jsonb_build_object(
      'gradeSubmissionId', p_grade_submission_id,
      'contentCommitment', encode(p_content_commitment, 'hex'),
      'saltReference', p_salt_reference
    )
  );

  if replay_result is not null then
    return replay_result;
  end if;

  if target_submission.state <> 'approved' then
    raise exception using
      errcode = '55000',
      message = 'Only approved grades can be published';
  end if;

  select enrollment.*
  into target_enrollment
  from public.enrollments enrollment
  where enrollment.id = target_submission.enrollment_id
    and enrollment.institution_id = target_submission.institution_id
  for update;

  select record.*
  into previous_record
  from public.grade_records record
  where record.enrollment_id = target_enrollment.id
    and record.is_current
  for update;

  if previous_record.id is not null and (
    target_submission.previous_grade_submission_id is distinct from
      previous_record.grade_submission_id
    or target_submission.correction_reason_code is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'A published grade requires a linked correction';
  end if;

  if previous_record.id is null
    and target_submission.previous_grade_submission_id is not null
  then
    raise exception using
      errcode = '23514',
      message = 'Correction chain does not match the current record';
  end if;

  next_grade_version := coalesce(previous_record.version_number, 0) + 1;

  if previous_record.id is not null then
    update public.grade_records record
    set
      is_current = false,
      superseded_at = now()
    where record.id = previous_record.id;
  end if;

  insert into public.grade_records (
    institution_id,
    enrollment_id,
    grade_submission_id,
    previous_grade_record_id,
    version_number,
    grade_code,
    grade_points,
    credit_hours_earned,
    correction_reason_code,
    published_at,
    created_by
  )
  values (
    target_submission.institution_id,
    target_enrollment.id,
    target_submission.id,
    previous_record.id,
    next_grade_version,
    target_submission.grade_code,
    target_submission.grade_points,
    case
      when target_submission.grade_points > 0 then target_enrollment.credit_hours
      else 0
    end,
    target_submission.correction_reason_code,
    now(),
    caller_id
  )
  returning id into grade_record_id;

  select version.*
  into previous_academic_version
  from public.academic_record_versions version
  where version.student_id = target_enrollment.student_id
    and version.is_current
  for update;

  next_academic_version := coalesce(previous_academic_version.version_number, 0) + 1;

  if previous_academic_version.id is not null then
    update public.academic_record_versions version
    set
      is_current = false,
      status = 'superseded',
      superseded_at = now()
    where version.id = previous_academic_version.id;
  end if;

  insert into public.academic_record_versions (
    institution_id,
    student_id,
    previous_version_id,
    version_number,
    content_commitment,
    salt_reference,
    status,
    anchor_status,
    correction_reason_code,
    is_current,
    published_at,
    created_by,
    source_grade_record_id
  )
  values (
    target_submission.institution_id,
    target_enrollment.student_id,
    previous_academic_version.id,
    next_academic_version,
    p_content_commitment,
    trim(p_salt_reference),
    'published',
    'not_configured',
    target_submission.correction_reason_code,
    true,
    now(),
    caller_id,
    grade_record_id
  )
  returning id into academic_record_version_id;

  update public.grade_submissions submission
  set
    state = 'published',
    published_by = caller_id,
    published_at = now(),
    updated_at = now(),
    updated_by = caller_id
  where submission.id = target_submission.id;

  update public.enrollments enrollment
  set
    status = 'completed',
    updated_at = now(),
    updated_by = caller_id
  where enrollment.id = target_enrollment.id;

  degree_audit_snapshot_id := lozzi_private.refresh_degree_audit(
    target_enrollment.student_id,
    academic_record_version_id,
    caller_id
  );

  result_payload := jsonb_build_object(
    'success', true,
    'gradeSubmissionId', target_submission.id,
    'gradeRecordId', grade_record_id,
    'gradeRecordVersion', next_grade_version,
    'academicRecordVersionId', academic_record_version_id,
    'academicRecordVersion', next_academic_version,
    'degreeAuditSnapshotId', degree_audit_snapshot_id,
    'state', 'published',
    'anchorStatus', 'not-configured',
    'message', 'Grade published to the official academic record.'
  );

  perform lozzi_private.complete_idempotent_operation(
    target_submission.institution_id,
    'grade.submission.publish',
    p_idempotency_key,
    grade_record_id,
    result_payload
  );

  insert into public.audit_events (
    institution_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    outcome,
    metadata
  )
  values (
    target_submission.institution_id,
    caller_id,
    'grade.submission.publish',
    'grade_record',
    grade_record_id,
    'success',
    jsonb_build_object(
      'gradeRecordVersion', next_grade_version,
      'academicRecordVersion', next_academic_version,
      'isCorrection', previous_record.id is not null,
      'anchorStatus', 'not_configured'
    )
  );

  return result_payload;
end;
$$;

create function public.start_grade_correction(
  p_grade_record_id uuid,
  p_reason_code text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_record public.grade_records%rowtype;
  target_submission public.grade_submissions%rowtype;
  target_enrollment public.enrollments%rowtype;
  correction_submission_id uuid;
  replay_result jsonb;
  result_payload jsonb;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_reason_code not in (
    'clerical_error',
    'calculation_error',
    'incomplete_resolved',
    'appeal_outcome',
    'other_documented'
  ) then
    raise exception using errcode = '22023', message = 'Invalid correction reason';
  end if;

  select record.*
  into target_record
  from public.grade_records record
  where record.id = p_grade_record_id
    and record.is_current
  for update;

  if target_record.id is null then
    raise exception using errcode = '22023', message = 'Current grade record not found';
  end if;

  select enrollment.*
  into target_enrollment
  from public.enrollments enrollment
  where enrollment.id = target_record.enrollment_id;

  if not (
    lozzi_private.is_section_instructor(target_enrollment.section_id)
    or lozzi_private.has_membership(
      target_record.institution_id,
      array['registrar', 'institution_admin']
    )
  ) then
    raise exception using errcode = '42501', message = 'Grade correction access required';
  end if;

  replay_result := lozzi_private.begin_idempotent_operation(
    target_record.institution_id,
    'grade.correction.start',
    p_idempotency_key,
    jsonb_build_object(
      'gradeRecordId', p_grade_record_id,
      'reasonCode', p_reason_code
    )
  );

  if replay_result is not null then
    return replay_result;
  end if;

  if exists (
    select 1
    from public.grade_submissions submission
    where submission.enrollment_id = target_record.enrollment_id
      and submission.state in ('draft', 'submitted', 'approved')
  ) then
    raise exception using
      errcode = '23505',
      message = 'A grade correction is already in progress';
  end if;

  select submission.*
  into target_submission
  from public.grade_submissions submission
  where submission.id = target_record.grade_submission_id;

  insert into public.grade_submissions (
    institution_id,
    enrollment_id,
    submitted_by,
    state,
    grade_code,
    grade_points,
    participation_score,
    assignment_average,
    final_exam_score,
    total_score,
    correction_reason_code,
    previous_grade_submission_id,
    idempotency_key,
    created_by,
    updated_by
  )
  values (
    target_record.institution_id,
    target_record.enrollment_id,
    caller_id,
    'draft',
    target_submission.grade_code,
    target_submission.grade_points,
    target_submission.participation_score,
    target_submission.assignment_average,
    target_submission.final_exam_score,
    target_submission.total_score,
    p_reason_code,
    target_submission.id,
    gen_random_uuid(),
    caller_id,
    caller_id
  )
  returning id into correction_submission_id;

  result_payload := jsonb_build_object(
    'success', true,
    'gradeRecordId', p_grade_record_id,
    'gradeSubmissionId', correction_submission_id,
    'state', 'draft',
    'message', 'Grade correction draft started.'
  );

  perform lozzi_private.complete_idempotent_operation(
    target_record.institution_id,
    'grade.correction.start',
    p_idempotency_key,
    correction_submission_id,
    result_payload
  );

  insert into public.audit_events (
    institution_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    outcome,
    metadata
  )
  values (
    target_record.institution_id,
    caller_id,
    'grade.correction.start',
    'grade_submission',
    correction_submission_id,
    'success',
    jsonb_build_object(
      'previousGradeRecordId', p_grade_record_id,
      'reasonCode', p_reason_code
    )
  );

  return result_payload;
end;
$$;

revoke all on function lozzi_private.grade_code_for_total(numeric)
  from public, anon, authenticated;
revoke all on function lozzi_private.grade_points_for_code(text)
  from public, anon, authenticated;
revoke all on function lozzi_private.begin_idempotent_operation(uuid, text, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function lozzi_private.complete_idempotent_operation(
  uuid,
  text,
  uuid,
  uuid,
  jsonb
) from public, anon, authenticated;
revoke all on function lozzi_private.refresh_degree_audit(uuid, uuid, uuid)
  from public, anon, authenticated;

revoke all on function public.save_grade_drafts(uuid, jsonb, uuid)
  from public, anon, authenticated;
revoke all on function public.submit_section_grades(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.approve_grade_submission(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.publish_grade_submission(uuid, bytea, text, uuid)
  from public, anon, authenticated;
revoke all on function public.start_grade_correction(uuid, text, uuid)
  from public, anon, authenticated;

grant execute on function public.save_grade_drafts(uuid, jsonb, uuid)
  to authenticated, service_role;
grant execute on function public.submit_section_grades(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.approve_grade_submission(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.publish_grade_submission(uuid, bytea, text, uuid)
  to authenticated, service_role;
grant execute on function public.start_grade_correction(uuid, text, uuid)
  to authenticated, service_role;
