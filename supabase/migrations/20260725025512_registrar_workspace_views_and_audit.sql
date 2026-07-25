create function lozzi_private.audit_scoped_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  current_row jsonb := to_jsonb(new);
  previous_row jsonb := to_jsonb(old);
  target_institution_id uuid;
  target_entity_id uuid;
  action_name text;
begin
  if caller_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and current_row = previous_row then
    return new;
  end if;

  target_entity_id := (current_row ->> 'id')::uuid;
  target_institution_id := coalesce(
    (current_row ->> 'institution_id')::uuid,
    target_entity_id
  );

  action_name := tg_table_name || case
    when tg_op = 'INSERT' then '.created'
    when previous_row ->> 'deactivated_at' is null
      and current_row ->> 'deactivated_at' is not null
      then '.deactivated'
    when previous_row ->> 'deactivated_at' is not null
      and current_row ->> 'deactivated_at' is null
      then '.reactivated'
    else '.updated'
  end;

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
    target_institution_id,
    caller_id,
    action_name,
    tg_table_name,
    target_entity_id,
    'success',
    jsonb_build_object('source', 'registrar_workspace')
  );

  return new;
end;
$$;

revoke all on function lozzi_private.audit_scoped_mutation()
from public, anon, authenticated, service_role;

do $$
declare
  table_name text;
  table_names text[] := array[
    'institutions',
    'institution_memberships',
    'staff_role_assignments',
    'departments',
    'academic_terms',
    'programs',
    'program_versions',
    'program_requirements',
    'courses',
    'course_prerequisites',
    'course_sections',
    'section_instructors',
    'section_meetings'
  ];
begin
  foreach table_name in array table_names loop
    execute format(
      'create trigger audit_%I_change after insert or update on public.%I
       for each row execute function lozzi_private.audit_scoped_mutation()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

create view public.registrar_workspace_summary
with (security_invoker = true)
as
select
  institution.id as institution_id,
  institution.name as institution_name,
  current_term.id as term_id,
  current_term.name as term_name,
  current_term.status as term_status,
  current_term.starts_on,
  current_term.ends_on,
  current_term.registration_opens_at,
  current_term.registration_closes_at,
  current_term.add_drop_deadline,
  current_term.withdrawal_deadline,
  current_term.grades_due_at,
  (
    select count(*)::integer
    from public.students student
    where student.institution_id = institution.id
      and student.academic_status = 'active'
      and student.deactivated_at is null
  ) as active_student_count,
  (
    select count(*)::integer
    from public.course_sections section
    where section.institution_id = institution.id
      and section.status <> 'cancelled'
      and section.deactivated_at is null
  ) as course_section_count,
  (
    select count(*)::integer
    from public.grade_submissions submission
    where submission.institution_id = institution.id
      and submission.state = 'approved'
  ) as records_awaiting_publication
from public.institutions institution
left join lateral (
  select term.*
  from public.academic_terms term
  where term.institution_id = institution.id
    and term.deactivated_at is null
  order by
    case term.status
      when 'registration_open' then 0
      when 'in_progress' then 1
      when 'planned' then 2
      else 3
    end,
    term.starts_on desc
  limit 1
) current_term on true
where institution.status = 'active'
  and lozzi_private.has_active_staff_role(
    institution.id,
    array['registrar', 'institution_admin']
  );

create view public.registrar_attention_queue
with (security_invoker = true)
as
select
  submission.id as item_id,
  submission.institution_id,
  student.id as student_id,
  student_profile.display_name as student_display_name,
  'Grade record'::text as record_type,
  course.code as course_code,
  course.title as course_title,
  submitter_profile.display_name as submitted_by_display_name,
  submission.submitted_at,
  submission.updated_at,
  submission.state as status,
  1 as version_number
from public.grade_submissions submission
join public.enrollments enrollment
  on enrollment.id = submission.enrollment_id
join public.students student
  on student.id = enrollment.student_id
join public.profiles student_profile
  on student_profile.id = student.user_id
join public.course_sections section
  on section.id = enrollment.section_id
join public.courses course
  on course.id = section.course_id
join public.profiles submitter_profile
  on submitter_profile.id = submission.submitted_by
where submission.state in ('submitted', 'approved')
  and lozzi_private.has_active_staff_role(
    submission.institution_id,
    array['registrar', 'institution_admin']
  );

create view public.registrar_student_directory
with (security_invoker = true)
as
select
  student.id as student_id,
  student.institution_id,
  student_profile.display_name,
  student.student_number,
  student.academic_status,
  student.expected_completion_date,
  program.name as program_name,
  program_version.version_number as program_version_number
from public.students student
join public.profiles student_profile
  on student_profile.id = student.user_id
left join public.student_programs student_program
  on student_program.student_id = student.id
  and student_program.status = 'active'
left join public.program_versions program_version
  on program_version.id = student_program.program_version_id
left join public.programs program
  on program.id = program_version.program_id
where student.deactivated_at is null
  and lozzi_private.has_active_staff_role(
    student.institution_id,
    array['registrar', 'institution_admin']
  );

create view public.registrar_section_directory
with (security_invoker = true)
as
select
  section.id as section_id,
  section.institution_id,
  section.term_id,
  term.name as term_name,
  course.id as course_id,
  course.code as course_code,
  course.title as course_title,
  section.section_code,
  section.capacity,
  section.enrolled_count,
  section.location,
  section.delivery_mode,
  section.status,
  coalesce(instructors.display_names, 'Staff not assigned') as instructors,
  coalesce(meetings.schedule, 'Schedule to be announced') as schedule
from public.course_sections section
join public.academic_terms term
  on term.id = section.term_id
join public.courses course
  on course.id = section.course_id
left join lateral (
  select string_agg(profile.display_name, ', ' order by profile.display_name)
    as display_names
  from public.section_instructors section_instructor
  join public.staff_role_assignments assignment
    on assignment.id = section_instructor.staff_role_assignment_id
  join public.profiles profile
    on profile.id = assignment.user_id
  where section_instructor.section_id = section.id
    and section_instructor.deactivated_at is null
) instructors on true
left join lateral (
  select string_agg(
    case meeting.weekday
      when 1 then 'Mon'
      when 2 then 'Tue'
      when 3 then 'Wed'
      when 4 then 'Thu'
      when 5 then 'Fri'
      when 6 then 'Sat'
      else 'Sun'
    end
      || ' '
      || to_char(meeting.starts_at, 'HH12:MI AM')
      || '–'
      || to_char(meeting.ends_at, 'HH12:MI AM'),
    ', '
    order by meeting.weekday, meeting.starts_at
  ) as schedule
  from public.section_meetings meeting
  where meeting.section_id = section.id
    and meeting.deactivated_at is null
) meetings on true
where section.deactivated_at is null
  and lozzi_private.has_active_staff_role(
    section.institution_id,
    array['registrar', 'institution_admin']
  );

create view public.registrar_audit_activity
with (security_invoker = true)
as
select
  event.id as activity_id,
  event.institution_id,
  event.occurred_at,
  coalesce(actor_profile.display_name, 'System') as actor_display_name,
  coalesce(actor_membership.role, 'system') as actor_role,
  event.action,
  event.entity_type,
  event.entity_id,
  event.outcome
from public.audit_events event
left join public.profiles actor_profile
  on actor_profile.id = event.actor_user_id
left join lateral (
  select membership.role
  from public.institution_memberships membership
  where membership.institution_id = event.institution_id
    and membership.user_id = event.actor_user_id
  order by
    case membership.role
      when 'institution_admin' then 0
      when 'registrar' then 1
      when 'instructor' then 2
      when 'advisor' then 3
      else 4
    end
  limit 1
) actor_membership on true
where event.institution_id is not null
  and lozzi_private.has_active_staff_role(
    event.institution_id,
    array['registrar', 'institution_admin']
  );

revoke all on
  public.registrar_workspace_summary,
  public.registrar_attention_queue,
  public.registrar_student_directory,
  public.registrar_section_directory,
  public.registrar_audit_activity
from public, anon, authenticated, service_role;

grant select on
  public.registrar_workspace_summary,
  public.registrar_attention_queue,
  public.registrar_student_directory,
  public.registrar_section_directory,
  public.registrar_audit_activity
to authenticated, service_role;
