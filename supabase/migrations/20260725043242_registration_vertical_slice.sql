alter table public.course_sections
  add column restriction_rules jsonb not null default '{}'::jsonb,
  add constraint course_sections_restriction_rules_object_check
    check (jsonb_typeof(restriction_rules) = 'object');

create table public.registration_requests (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  term_id uuid not null references public.academic_terms(id) on delete restrict,
  idempotency_key uuid not null,
  requested_section_ids uuid[] not null,
  status text not null check (status in ('accepted', 'rejected')),
  result jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  unique (institution_id, idempotency_key),
  check (cardinality(requested_section_ids) between 1 and 10),
  check (jsonb_typeof(result) = 'object')
);

create index registration_requests_student_recent_idx
  on public.registration_requests (student_id, created_at desc);
create index registration_requests_term_idx
  on public.registration_requests (institution_id, term_id, created_at desc);

alter table public.registration_requests enable row level security;
alter table public.registration_requests force row level security;

revoke all on table public.registration_requests
from public, anon, authenticated, service_role;
grant all on table public.registration_requests to service_role;
grant select on table public.registration_requests to authenticated;

create policy registration_requests_authorized_select
on public.registration_requests for select to authenticated
using (
  lozzi_private.is_student_self(student_id)
  or lozzi_private.has_membership(
    institution_id,
    array['registrar', 'institution_admin']
  )
);

create or replace function lozzi_private.registration_eligibility(
  target_student_id uuid,
  target_section_id uuid,
  requested_section_ids uuid[] default array[]::uuid[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  student_row public.students%rowtype;
  section_row public.course_sections%rowtype;
  course_row public.courses%rowtype;
  term_row public.academic_terms%rowtype;
  prerequisite_row record;
  program_code text;
  current_credits numeric(6,2);
  requested_credits numeric(6,2);
  blocking_reasons jsonb := '[]'::jsonb;
  warnings jsonb := '[]'::jsonb;
  related_id uuid;
begin
  select * into student_row
  from public.students
  where id = target_student_id
    and deactivated_at is null;

  select * into section_row
  from public.course_sections
  where id = target_section_id
    and deactivated_at is null;

  if student_row.id is null or section_row.id is null
    or student_row.institution_id <> section_row.institution_id
  then
    return jsonb_build_object(
      'eligible', false,
      'blockingReasons', jsonb_build_array(jsonb_build_object(
        'code', 'SECTION_NOT_FOUND',
        'message', 'This section is no longer available.',
        'relatedEntityId', target_section_id
      )),
      'warnings', warnings
    );
  end if;

  select * into course_row
  from public.courses
  where id = section_row.course_id
    and institution_id = student_row.institution_id;

  select * into term_row
  from public.academic_terms
  where id = section_row.term_id
    and institution_id = student_row.institution_id
    and deactivated_at is null;

  if student_row.academic_status <> 'active' then
    blocking_reasons := blocking_reasons || jsonb_build_array(jsonb_build_object(
      'code', 'STUDENT_NOT_ACTIVE',
      'message', 'Your academic status does not currently permit registration.',
      'relatedEntityId', student_row.id
    ));
  end if;

  if term_row.id is null
    or term_row.status <> 'registration_open'
    or term_row.registration_opens_at is null
    or term_row.registration_closes_at is null
    or now() < term_row.registration_opens_at
    or now() > term_row.registration_closes_at
  then
    blocking_reasons := blocking_reasons || jsonb_build_array(jsonb_build_object(
      'code', 'REGISTRATION_CLOSED',
      'message', 'Registration is not open for this academic term.',
      'relatedEntityId', section_row.term_id
    ));
  end if;

  if section_row.status <> 'open' then
    blocking_reasons := blocking_reasons || jsonb_build_array(jsonb_build_object(
      'code', 'SECTION_CLOSED',
      'message', 'This section is not open for registration.',
      'relatedEntityId', section_row.id
    ));
  end if;

  if section_row.enrolled_count >= section_row.capacity then
    blocking_reasons := blocking_reasons || jsonb_build_array(jsonb_build_object(
      'code', 'SECTION_FULL',
      'message', 'This section has no remaining seats.',
      'relatedEntityId', section_row.id
    ));
  elsif section_row.capacity - section_row.enrolled_count <= 3 then
    warnings := warnings || jsonb_build_array(jsonb_build_object(
      'code', 'LIMITED_SEATS',
      'message', 'Only a few seats remain in this section.',
      'relatedEntityId', section_row.id
    ));
  end if;

  if exists (
    select 1
    from public.enrollments enrollment
    where enrollment.student_id = student_row.id
      and enrollment.section_id = section_row.id
      and enrollment.status in ('pending', 'enrolled', 'waitlisted')
  ) then
    blocking_reasons := blocking_reasons || jsonb_build_array(jsonb_build_object(
      'code', 'DUPLICATE_ENROLLMENT',
      'message', 'You are already registered for this section.',
      'relatedEntityId', section_row.id
    ));
  end if;

  if course_row.repeat_policy = 'restricted' and exists (
    select 1
    from public.grade_records grade
    join public.enrollments enrollment on enrollment.id = grade.enrollment_id
    join public.course_sections completed_section
      on completed_section.id = enrollment.section_id
    where enrollment.student_id = student_row.id
      and completed_section.course_id = course_row.id
      and enrollment.status = 'completed'
      and grade.is_current
  ) then
    blocking_reasons := blocking_reasons || jsonb_build_array(jsonb_build_object(
      'code', 'COURSE_ALREADY_COMPLETED',
      'message', 'This course cannot be repeated without institutional approval.',
      'relatedEntityId', course_row.id
    ));
  end if;

  for prerequisite_row in
    select
      prerequisite.id,
      prerequisite.kind,
      prerequisite.prerequisite_course_id,
      prerequisite.minimum_grade_points,
      required_course.code,
      required_course.title
    from public.course_prerequisites prerequisite
    join public.courses required_course
      on required_course.id = prerequisite.prerequisite_course_id
    where prerequisite.institution_id = student_row.institution_id
      and prerequisite.course_id = course_row.id
      and prerequisite.deactivated_at is null
  loop
    if prerequisite_row.kind = 'prerequisite' and not exists (
      select 1
      from public.grade_records grade
      join public.enrollments enrollment on enrollment.id = grade.enrollment_id
      join public.course_sections completed_section
        on completed_section.id = enrollment.section_id
      where enrollment.student_id = student_row.id
        and completed_section.course_id = prerequisite_row.prerequisite_course_id
        and enrollment.status = 'completed'
        and grade.is_current
        and coalesce(grade.grade_points, 0) >= prerequisite_row.minimum_grade_points
    ) then
      blocking_reasons := blocking_reasons || jsonb_build_array(jsonb_build_object(
        'code', 'MISSING_PREREQUISITE',
        'message', format(
          '%s requires completion of %s %s.',
          course_row.title,
          prerequisite_row.code,
          prerequisite_row.title
        ),
        'relatedEntityId', prerequisite_row.prerequisite_course_id
      ));
    elsif prerequisite_row.kind = 'corequisite' and not (
      exists (
        select 1
        from public.grade_records grade
        join public.enrollments enrollment on enrollment.id = grade.enrollment_id
        join public.course_sections completed_section
          on completed_section.id = enrollment.section_id
        where enrollment.student_id = student_row.id
          and completed_section.course_id = prerequisite_row.prerequisite_course_id
          and enrollment.status = 'completed'
          and grade.is_current
          and coalesce(grade.grade_points, 0) >= prerequisite_row.minimum_grade_points
      )
      or exists (
        select 1
        from public.enrollments enrollment
        join public.course_sections active_section
          on active_section.id = enrollment.section_id
        where enrollment.student_id = student_row.id
          and active_section.term_id = section_row.term_id
          and active_section.course_id = prerequisite_row.prerequisite_course_id
          and enrollment.status in ('pending', 'enrolled', 'waitlisted')
      )
      or exists (
        select 1
        from public.course_sections requested_section
        where requested_section.id = any(requested_section_ids)
          and requested_section.term_id = section_row.term_id
          and requested_section.course_id = prerequisite_row.prerequisite_course_id
      )
    ) then
      blocking_reasons := blocking_reasons || jsonb_build_array(jsonb_build_object(
        'code', 'MISSING_COREQUISITE',
        'message', format(
          '%s must be taken with %s %s.',
          course_row.title,
          prerequisite_row.code,
          prerequisite_row.title
        ),
        'relatedEntityId', prerequisite_row.prerequisite_course_id
      ));
    end if;
  end loop;

  select coalesce(sum(enrollment.credit_hours), 0)
  into current_credits
  from public.enrollments enrollment
  join public.course_sections active_section
    on active_section.id = enrollment.section_id
  where enrollment.student_id = student_row.id
    and active_section.term_id = section_row.term_id
    and enrollment.status in ('pending', 'enrolled', 'waitlisted');

  select coalesce(sum(requested_course.credit_hours), 0)
  into requested_credits
  from public.course_sections requested_section
  join public.courses requested_course on requested_course.id = requested_section.course_id
  where requested_section.id = any(requested_section_ids)
    and requested_section.term_id = section_row.term_id
    and not exists (
      select 1
      from public.enrollments existing
      where existing.student_id = student_row.id
        and existing.section_id = requested_section.id
        and existing.status in ('pending', 'enrolled', 'waitlisted')
    );

  if current_credits + requested_credits > term_row.max_credits then
    blocking_reasons := blocking_reasons || jsonb_build_array(jsonb_build_object(
      'code', 'MAX_CREDIT_LOAD',
      'message', format(
        'This selection would exceed the %s-credit term limit.',
        trim(to_char(term_row.max_credits, 'FM999990.##'))
      ),
      'relatedEntityId', term_row.id
    ));
  end if;

  select hold.id into related_id
  from public.student_holds hold
  where hold.student_id = student_row.id
    and hold.status = 'active'
    and hold.is_blocking
  order by hold.placed_at
  limit 1;

  if related_id is not null then
    blocking_reasons := blocking_reasons || jsonb_build_array(jsonb_build_object(
      'code', 'BLOCKING_HOLD',
      'message', 'A blocking hold must be resolved before registration.',
      'relatedEntityId', related_id
    ));
  end if;

  select conflicting_section.id into related_id
  from public.section_meetings target_meeting
  join public.section_meetings conflicting_meeting
    on conflicting_meeting.weekday = target_meeting.weekday
    and conflicting_meeting.starts_at < target_meeting.ends_at
    and conflicting_meeting.ends_at > target_meeting.starts_at
    and conflicting_meeting.deactivated_at is null
  join public.course_sections conflicting_section
    on conflicting_section.id = conflicting_meeting.section_id
  join public.enrollments conflicting_enrollment
    on conflicting_enrollment.section_id = conflicting_section.id
  where target_meeting.section_id = section_row.id
    and target_meeting.deactivated_at is null
    and conflicting_enrollment.student_id = student_row.id
    and conflicting_enrollment.status in ('pending', 'enrolled', 'waitlisted')
    and conflicting_section.id <> section_row.id
  order by conflicting_section.id
  limit 1;

  if related_id is null then
    select conflicting_section.id into related_id
    from public.section_meetings target_meeting
    join public.section_meetings conflicting_meeting
      on conflicting_meeting.weekday = target_meeting.weekday
      and conflicting_meeting.starts_at < target_meeting.ends_at
      and conflicting_meeting.ends_at > target_meeting.starts_at
      and conflicting_meeting.deactivated_at is null
    join public.course_sections conflicting_section
      on conflicting_section.id = conflicting_meeting.section_id
    where target_meeting.section_id = section_row.id
      and target_meeting.deactivated_at is null
      and conflicting_section.id = any(requested_section_ids)
      and conflicting_section.id <> section_row.id
    order by conflicting_section.id
    limit 1;
  end if;

  if related_id is not null then
    blocking_reasons := blocking_reasons || jsonb_build_array(jsonb_build_object(
      'code', 'SCHEDULE_CONFLICT',
      'message', 'This section overlaps another selected or registered section.',
      'relatedEntityId', related_id
    ));
  end if;

  if exists (
    select 1
    from jsonb_object_keys(section_row.restriction_rules) rule_key
    where rule_key not in ('allowedAcademicStatuses', 'allowedProgramCodes')
  ) then
    blocking_reasons := blocking_reasons || jsonb_build_array(jsonb_build_object(
      'code', 'UNSUPPORTED_SECTION_RESTRICTION',
      'message', 'This section has a restriction that requires registrar review.',
      'relatedEntityId', section_row.id
    ));
  end if;

  if section_row.restriction_rules ? 'allowedAcademicStatuses'
    and not (
      section_row.restriction_rules -> 'allowedAcademicStatuses'
      @> to_jsonb(array[student_row.academic_status])
    )
  then
    blocking_reasons := blocking_reasons || jsonb_build_array(jsonb_build_object(
      'code', 'SECTION_RESTRICTION',
      'message', 'Your academic status does not meet this section restriction.',
      'relatedEntityId', section_row.id
    ));
  end if;

  if section_row.restriction_rules ? 'allowedProgramCodes' then
    select program.code into program_code
    from public.student_programs student_program
    join public.program_versions program_version
      on program_version.id = student_program.program_version_id
    join public.programs program on program.id = program_version.program_id
    where student_program.student_id = student_row.id
      and student_program.status = 'active'
    order by student_program.assigned_at desc
    limit 1;

    if program_code is null or not (
      section_row.restriction_rules -> 'allowedProgramCodes'
      @> to_jsonb(array[program_code])
    ) then
      blocking_reasons := blocking_reasons || jsonb_build_array(jsonb_build_object(
        'code', 'SECTION_RESTRICTION',
        'message', 'Your programme does not meet this section restriction.',
        'relatedEntityId', section_row.id
      ));
    end if;
  end if;

  return jsonb_build_object(
    'eligible', jsonb_array_length(blocking_reasons) = 0,
    'blockingReasons', blocking_reasons,
    'warnings', warnings
  );
end;
$$;

revoke all on function lozzi_private.registration_eligibility(uuid, uuid, uuid[])
from public, anon, authenticated;

create or replace function public.check_registration_eligibility(
  section_id uuid,
  requested_section_ids uuid[] default array[]::uuid[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_student_id uuid;
  bounded_section_ids uuid[];
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select student.id into target_student_id
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

  if target_student_id is null then
    raise exception using errcode = '42501', message = 'Student access required';
  end if;

  bounded_section_ids := case
    when cardinality(requested_section_ids) = 0 then array[section_id]
    else requested_section_ids
  end;

  if cardinality(bounded_section_ids) > 10
    or section_id <> all(bounded_section_ids)
  then
    raise exception using errcode = '22023', message = 'Invalid section selection';
  end if;

  return lozzi_private.registration_eligibility(
    target_student_id,
    section_id,
    bounded_section_ids
  );
end;
$$;

revoke all on function public.check_registration_eligibility(uuid, uuid[])
from public, anon, authenticated;
grant execute on function public.check_registration_eligibility(uuid, uuid[])
to authenticated;

create or replace function public.get_registration_catalog(p_term_id uuid default null)
returns table (
  student_id uuid,
  institution_id uuid,
  term_id uuid,
  term_name text,
  registration_closes_at timestamptz,
  add_drop_deadline timestamptz,
  section_id uuid,
  course_id uuid,
  course_code text,
  course_title text,
  credit_hours numeric,
  section_code text,
  capacity integer,
  enrolled_count integer,
  available_seats integer,
  location text,
  delivery_mode text,
  section_status text,
  instructor text,
  meetings jsonb,
  prerequisites jsonb,
  enrollment_id uuid,
  enrollment_status text,
  eligibility jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_student public.students%rowtype;
  selected_term_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
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

  if p_term_id is not null then
    select academic_term.id into selected_term_id
    from public.academic_terms academic_term
    where academic_term.id = p_term_id
      and academic_term.institution_id = target_student.institution_id
      and academic_term.deactivated_at is null;
  else
    select academic_term.id into selected_term_id
    from public.academic_terms academic_term
    where academic_term.institution_id = target_student.institution_id
      and academic_term.deactivated_at is null
    order by
      case academic_term.status
        when 'registration_open' then 0
        when 'in_progress' then 1
        when 'planned' then 2
        else 3
      end,
      academic_term.starts_on desc
    limit 1;
  end if;

  if selected_term_id is null then
    return;
  end if;

  return query
  select
    target_student.id,
    target_student.institution_id,
    academic_term.id,
    academic_term.name,
    academic_term.registration_closes_at,
    academic_term.add_drop_deadline,
    section.id,
    course.id,
    course.code,
    course.title,
    course.credit_hours,
    section.section_code,
    section.capacity,
    section.enrolled_count,
    greatest(section.capacity - section.enrolled_count, 0),
    section.location,
    section.delivery_mode,
    section.status,
    coalesce(instructor_names.names, 'Staff'),
    coalesce(meeting_rows.items, '[]'::jsonb),
    coalesce(prerequisite_rows.items, '[]'::jsonb),
    enrollment.id,
    enrollment.status,
    lozzi_private.registration_eligibility(
      target_student.id,
      section.id,
      array[section.id]
    )
  from public.course_sections section
  join public.courses course
    on course.id = section.course_id
    and course.institution_id = section.institution_id
  join public.academic_terms academic_term
    on academic_term.id = section.term_id
    and academic_term.institution_id = section.institution_id
  left join public.enrollments enrollment
    on enrollment.student_id = target_student.id
    and enrollment.section_id = section.id
  left join lateral (
    select string_agg(profile.display_name, ', ' order by assignment.is_primary desc) names
    from public.section_instructors assignment
    join public.staff_role_assignments staff_role
      on staff_role.id = assignment.staff_role_assignment_id
    join public.profiles profile on profile.id = staff_role.user_id
    where assignment.section_id = section.id
      and assignment.deactivated_at is null
      and staff_role.status = 'active'
      and staff_role.deactivated_at is null
  ) instructor_names on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'weekday', meeting.weekday,
        'startsAt', meeting.starts_at,
        'endsAt', meeting.ends_at,
        'location', meeting.location
      )
      order by meeting.weekday, meeting.starts_at
    ) items
    from public.section_meetings meeting
    where meeting.section_id = section.id
      and meeting.deactivated_at is null
  ) meeting_rows on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'courseId', required_course.id,
        'code', required_course.code,
        'title', required_course.title,
        'kind', prerequisite.kind
      )
      order by required_course.code
    ) items
    from public.course_prerequisites prerequisite
    join public.courses required_course
      on required_course.id = prerequisite.prerequisite_course_id
    where prerequisite.course_id = course.id
      and prerequisite.deactivated_at is null
  ) prerequisite_rows on true
  where section.institution_id = target_student.institution_id
    and section.term_id = selected_term_id
    and section.deactivated_at is null
    and course.status = 'active'
    and course.deactivated_at is null
  order by course.code, section.section_code;
end;
$$;

revoke all on function public.get_registration_catalog(uuid)
from public, anon, authenticated;
grant execute on function public.get_registration_catalog(uuid)
to authenticated;

comment on function public.check_registration_eligibility(uuid, uuid[])
is 'Returns deterministic student registration eligibility for one section.';
comment on function public.get_registration_catalog(uuid)
is 'Returns the authenticated student registration catalog for one institution term.';
