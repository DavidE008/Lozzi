create view public.registrar_registration_activity
with (security_invoker = true)
as
select
  request.id as request_id,
  request.institution_id,
  request.student_id,
  profile.display_name as student_display_name,
  academic_term.name as term_name,
  request.status,
  cardinality(request.requested_section_ids) as section_count,
  request.created_at
from public.registration_requests request
join public.students student on student.id = request.student_id
join public.profiles profile on profile.id = student.user_id
join public.academic_terms academic_term on academic_term.id = request.term_id
where lozzi_private.has_membership(
  request.institution_id,
  array['registrar', 'institution_admin']
);

revoke all on table public.registrar_registration_activity
from public, anon, authenticated, service_role;
grant select on table public.registrar_registration_activity to authenticated;

comment on view public.registrar_registration_activity
is 'Read-only institution-scoped registration request activity for registrars.';
