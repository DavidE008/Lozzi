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
    hashtextextended(
      target_student.institution_id::text || ':' || p_idempotency_key::text,
      0
    )
  );

  select request.result into existing_result
  from public.registration_requests request
  where request.institution_id = target_student.institution_id
    and request.idempotency_key = p_idempotency_key;

  if existing_result is not null then
    return existing_result || jsonb_build_object('idempotentReplay', true);
  end if;

  select section.term_id
  into selected_term_id
  from public.course_sections section
  where section.id = any(p_section_ids)
    and section.institution_id = target_student.institution_id
    and section.deactivated_at is null
  order by section.term_id
  limit 1;

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

comment on function public.register_for_sections(uuid[], uuid)
is 'Atomically registers the authenticated student for a bounded section set with locked capacity and idempotent replay.';
