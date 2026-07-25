create or replace view public.registrar_workspace_summary
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
      and section.term_id = current_term.id
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

revoke all on table public.registrar_workspace_summary
from public, anon, authenticated, service_role;
grant select on table public.registrar_workspace_summary to authenticated;

comment on view public.registrar_workspace_summary
is 'Read-only institution-scoped summary for registrar operations and the selected current term.';
