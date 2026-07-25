create or replace function public.register_for_sections(
  p_section_ids uuid[],
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
  target_student public.students%rowtype;
  selected_term_id uuid;
  section_id uuid;
  request_id uuid := gen_random_uuid();
  existing_result jsonb;
  eligibility jsonb;
  eligibility_results jsonb := '[]'::jsonb;
  enrollment_ids jsonb := '[]'::jsonb;
  result_payload jsonb;
  section_count integer;
  distinct_section_count integer;
  enrollment_id uuid;
  course_credits numeric(5,2);
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_idempotency_key is null
    or p_section_ids is null
    or cardinality(p_section_ids) not between 1 and 10
  then
    raise exception using errcode = '22023', message = 'Invalid registration request';
  end if;

  select count(*), count(distinct item)
  into section_count, distinct_section_count
  from unnest(p_section_ids) item;

  if section_count <> distinct_section_count then
    raise exception using errcode = '22023', message = 'Duplicate section selection';
  end if;

  select student.* into target_student
  from public.students student
  join public.institution_memberships membership
    on membership.institution_id = student.institution_id
    and membership.user_id = student.user_id
    and membership.role = 'student'
    and membership.status = 'active'
    and membership.deactivated_at is null
  where student.user_id = caller_id
    and student.deactivated_at is null
  limit 1;

  if target_student.id is null then
    raise exception using errcode = '42501', message = 'Student access required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_student.institution_id::text || ':' || p_idempotency_key::text, 0)
  );

  select request.result into existing_result
  from public.registration_requests request
  where request.institution_id = target_student.institution_id
    and request.idempotency_key = p_idempotency_key;

  if existing_result is not null then
    return existing_result || jsonb_build_object('idempotentReplay', true);
  end if;

  select min(section.term_id)
  into selected_term_id
  from public.course_sections section
  where section.id = any(p_section_ids)
    and section.institution_id = target_student.institution_id
    and section.deactivated_at is null;

  if selected_term_id is null or (
    select count(*)
    from public.course_sections section
    where section.id = any(p_section_ids)
      and section.institution_id = target_student.institution_id
      and section.term_id = selected_term_id
      and section.deactivated_at is null
  ) <> cardinality(p_section_ids) then
    raise exception using errcode = '22023', message = 'Sections must belong to one available term';
  end if;

  perform section.id
  from public.course_sections section
  where section.id = any(p_section_ids)
  order by section.id
  for update;

  foreach section_id in array p_section_ids loop
    eligibility := lozzi_private.registration_eligibility(
      target_student.id,
      section_id,
      p_section_ids
    );
    eligibility_results := eligibility_results || jsonb_build_array(
      jsonb_build_object(
        'sectionId', section_id,
        'eligibility', eligibility
      )
    );
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(eligibility_results) item
    where coalesce((item -> 'eligibility' ->> 'eligible')::boolean, false) = false
  ) then
    result_payload := jsonb_build_object(
      'success', false,
      'requestId', request_id,
      'eligibility', eligibility_results,
      'message', 'Registration was not submitted because one or more sections are ineligible.'
    );

    insert into public.registration_requests (
      id,
      institution_id,
      student_id,
      term_id,
      idempotency_key,
      requested_section_ids,
      status,
      result,
      created_by
    )
    values (
      request_id,
      target_student.institution_id,
      target_student.id,
      selected_term_id,
      p_idempotency_key,
      p_section_ids,
      'rejected',
      result_payload,
      caller_id
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
      target_student.institution_id,
      caller_id,
      'registration.submit',
      'registration_request',
      request_id,
      'denied',
      jsonb_build_object(
        'termId', selected_term_id,
        'sectionCount', cardinality(p_section_ids)
      )
    );

    return result_payload;
  end if;

  foreach section_id in array p_section_ids loop
    select course.credit_hours into course_credits
    from public.course_sections section
    join public.courses course on course.id = section.course_id
    where section.id = section_id;

    insert into public.enrollments (
      institution_id,
      student_id,
      section_id,
      status,
      credit_hours,
      enrolled_at,
      withdrawn_at,
      idempotency_key,
      created_by,
      updated_by
    )
    values (
      target_student.institution_id,
      target_student.id,
      section_id,
      'enrolled',
      course_credits,
      now(),
      null,
      gen_random_uuid(),
      caller_id,
      caller_id
    )
    on conflict (student_id, section_id) do update
      set status = 'enrolled',
          credit_hours = excluded.credit_hours,
          enrolled_at = now(),
          withdrawn_at = null,
          idempotency_key = gen_random_uuid(),
          updated_at = now(),
          updated_by = caller_id
      where public.enrollments.status in ('dropped', 'withdrawn')
    returning id into enrollment_id;

    if enrollment_id is null then
      raise exception using errcode = '23505', message = 'Duplicate active enrollment';
    end if;

    update public.course_sections section
    set enrolled_count = section.enrolled_count + 1,
        updated_at = now(),
        updated_by = caller_id
    where section.id = section_id
      and section.enrolled_count < section.capacity;

    if not found then
      raise exception using errcode = '40001', message = 'Section capacity changed';
    end if;

    enrollment_ids := enrollment_ids || to_jsonb(enrollment_id);
  end loop;

  result_payload := jsonb_build_object(
    'success', true,
    'requestId', request_id,
    'enrollmentIds', enrollment_ids,
    'eligibility', eligibility_results,
    'message', 'Registration submitted successfully.'
  );

  insert into public.registration_requests (
    id,
    institution_id,
    student_id,
    term_id,
    idempotency_key,
    requested_section_ids,
    status,
    result,
    created_by
  )
  values (
    request_id,
    target_student.institution_id,
    target_student.id,
    selected_term_id,
    p_idempotency_key,
    p_section_ids,
    'accepted',
    result_payload,
    caller_id
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
    target_student.institution_id,
    caller_id,
    'registration.submit',
    'registration_request',
    request_id,
    'success',
    jsonb_build_object(
      'termId', selected_term_id,
      'sectionCount', cardinality(p_section_ids)
    )
  );

  return result_payload;
end;
$$;

revoke all on function public.register_for_sections(uuid[], uuid)
from public, anon, authenticated;
grant execute on function public.register_for_sections(uuid[], uuid)
to authenticated;

create or replace function public.withdraw_from_section(
  p_enrollment_id uuid,
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
  target_student public.students%rowtype;
  enrollment_row public.enrollments%rowtype;
  section_row public.course_sections%rowtype;
  term_row public.academic_terms%rowtype;
  request_id uuid := gen_random_uuid();
  existing_result jsonb;
  result_payload jsonb;
  remaining_credits numeric(6,2);
  next_status text;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_enrollment_id is null or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'Invalid withdrawal request';
  end if;

  select student.* into target_student
  from public.students student
  join public.institution_memberships membership
    on membership.institution_id = student.institution_id
    and membership.user_id = student.user_id
    and membership.role = 'student'
    and membership.status = 'active'
    and membership.deactivated_at is null
  where student.user_id = caller_id
    and student.deactivated_at is null
  limit 1;

  if target_student.id is null then
    raise exception using errcode = '42501', message = 'Student access required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_student.institution_id::text || ':' || p_idempotency_key::text, 0)
  );

  select request.result into existing_result
  from public.registration_requests request
  where request.institution_id = target_student.institution_id
    and request.idempotency_key = p_idempotency_key;

  if existing_result is not null then
    return existing_result || jsonb_build_object('idempotentReplay', true);
  end if;

  select enrollment.* into enrollment_row
  from public.enrollments enrollment
  where enrollment.id = p_enrollment_id
    and enrollment.student_id = target_student.id;

  if enrollment_row.id is null then
    raise exception using errcode = '42501', message = 'Enrollment access required';
  end if;

  select section.* into section_row
  from public.course_sections section
  where section.id = enrollment_row.section_id
  for update;

  select enrollment.* into enrollment_row
  from public.enrollments enrollment
  where enrollment.id = p_enrollment_id
    and enrollment.student_id = target_student.id
  for update;

  select academic_term.* into term_row
  from public.academic_terms academic_term
  where academic_term.id = section_row.term_id;

  if enrollment_row.status not in ('pending', 'enrolled', 'waitlisted') then
    result_payload := jsonb_build_object(
      'success', false,
      'requestId', request_id,
      'code', 'ENROLLMENT_NOT_ACTIVE',
      'message', 'This enrollment is no longer active.'
    );
  elsif term_row.add_drop_deadline is not null and now() <= term_row.add_drop_deadline then
    next_status := 'dropped';
  elsif term_row.withdrawal_deadline is not null and now() <= term_row.withdrawal_deadline then
    next_status := 'withdrawn';
  else
    result_payload := jsonb_build_object(
      'success', false,
      'requestId', request_id,
      'code', 'WITHDRAWAL_CLOSED',
      'message', 'The withdrawal deadline has passed.'
    );
  end if;

  if result_payload is null and enrollment_row.status <> 'waitlisted' then
    select coalesce(sum(active_enrollment.credit_hours), 0) - enrollment_row.credit_hours
    into remaining_credits
    from public.enrollments active_enrollment
    join public.course_sections active_section
      on active_section.id = active_enrollment.section_id
    where active_enrollment.student_id = target_student.id
      and active_section.term_id = term_row.id
      and active_enrollment.status in ('pending', 'enrolled', 'waitlisted');

    if remaining_credits < term_row.min_credits then
      result_payload := jsonb_build_object(
        'success', false,
        'requestId', request_id,
        'code', 'MIN_CREDIT_LOAD',
        'message', format(
          'Withdrawal would fall below the %s-credit term minimum.',
          trim(to_char(term_row.min_credits, 'FM999990.##'))
        )
      );
    end if;
  end if;

  if result_payload is not null then
    insert into public.registration_requests (
      id,
      institution_id,
      student_id,
      term_id,
      idempotency_key,
      requested_section_ids,
      status,
      result,
      created_by
    )
    values (
      request_id,
      target_student.institution_id,
      target_student.id,
      term_row.id,
      p_idempotency_key,
      array[section_row.id],
      'rejected',
      result_payload,
      caller_id
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
      target_student.institution_id,
      caller_id,
      'registration.withdraw',
      'enrollment',
      enrollment_row.id,
      'denied',
      jsonb_build_object('termId', term_row.id)
    );

    return result_payload;
  end if;

  update public.enrollments
  set status = next_status,
      withdrawn_at = now(),
      updated_at = now(),
      updated_by = caller_id
  where id = enrollment_row.id;

  if enrollment_row.status <> 'waitlisted' then
    update public.course_sections
    set enrolled_count = greatest(enrolled_count - 1, 0),
        updated_at = now(),
        updated_by = caller_id
    where id = section_row.id;
  end if;

  result_payload := jsonb_build_object(
    'success', true,
    'requestId', request_id,
    'enrollmentId', enrollment_row.id,
    'status', next_status,
    'message', case
      when next_status = 'dropped' then 'Course dropped successfully.'
      else 'Withdrawal submitted successfully.'
    end
  );

  insert into public.registration_requests (
    id,
    institution_id,
    student_id,
    term_id,
    idempotency_key,
    requested_section_ids,
    status,
    result,
    created_by
  )
  values (
    request_id,
    target_student.institution_id,
    target_student.id,
    term_row.id,
    p_idempotency_key,
    array[section_row.id],
    'accepted',
    result_payload,
    caller_id
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
    target_student.institution_id,
    caller_id,
    'registration.withdraw',
    'enrollment',
    enrollment_row.id,
    'success',
    jsonb_build_object(
      'termId', term_row.id,
      'resultStatus', next_status
    )
  );

  return result_payload;
end;
$$;

revoke all on function public.withdraw_from_section(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.withdraw_from_section(uuid, uuid)
to authenticated;

comment on function public.register_for_sections(uuid[], uuid)
is 'Atomically and idempotently registers the authenticated student for up to ten eligible sections.';
comment on function public.withdraw_from_section(uuid, uuid)
is 'Atomically and idempotently drops or withdraws the authenticated student when term rules permit.';
