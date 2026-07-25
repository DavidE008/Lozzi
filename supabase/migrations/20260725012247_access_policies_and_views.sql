create function lozzi_private.has_membership(
  target_institution_id uuid,
  allowed_roles text[] default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.institution_memberships membership
    where membership.institution_id = target_institution_id
      and membership.user_id = caller_id
      and membership.status = 'active'
      and membership.deactivated_at is null
      and (allowed_roles is null or membership.role = any (allowed_roles))
  );
end;
$$;

create function lozzi_private.is_student_self(target_student_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.students student
    where student.id = target_student_id
      and student.user_id = caller_id
      and student.deactivated_at is null
  );
end;
$$;

create function lozzi_private.is_assigned_advisor(target_student_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.advisor_assignments assignment
    join public.staff_role_assignments staff_role
      on staff_role.id = assignment.advisor_role_assignment_id
    where assignment.student_id = target_student_id
      and assignment.status = 'active'
      and assignment.deactivated_at is null
      and (assignment.ends_at is null or assignment.ends_at > now())
      and staff_role.user_id = caller_id
      and staff_role.role = 'advisor'
      and staff_role.status = 'active'
      and staff_role.deactivated_at is null
  );
end;
$$;

create function lozzi_private.is_section_instructor(target_section_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.section_instructors assignment
    join public.staff_role_assignments staff_role
      on staff_role.id = assignment.staff_role_assignment_id
    where assignment.section_id = target_section_id
      and staff_role.user_id = caller_id
      and staff_role.role = 'instructor'
      and staff_role.status = 'active'
      and staff_role.deactivated_at is null
      and (staff_role.valid_until is null or staff_role.valid_until > now())
  );
end;
$$;

create function lozzi_private.can_view_student(target_student_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  student_institution_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  select institution_id
  into student_institution_id
  from public.students
  where id = target_student_id
    and deactivated_at is null;

  if student_institution_id is null then
    return false;
  end if;

  return lozzi_private.is_student_self(target_student_id)
    or lozzi_private.has_membership(
      student_institution_id,
      array['registrar', 'institution_admin']
    )
    or lozzi_private.is_assigned_advisor(target_student_id)
    or exists (
      select 1
      from public.enrollments enrollment
      where enrollment.student_id = target_student_id
        and enrollment.status in ('enrolled', 'completed')
        and lozzi_private.is_section_instructor(enrollment.section_id)
    );
end;
$$;

create function lozzi_private.can_view_academic_record(target_student_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  student_institution_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  select institution_id
  into student_institution_id
  from public.students
  where id = target_student_id
    and deactivated_at is null;

  return student_institution_id is not null
    and (
      lozzi_private.is_student_self(target_student_id)
      or lozzi_private.has_membership(
        student_institution_id,
        array['registrar', 'institution_admin']
      )
      or lozzi_private.is_assigned_advisor(target_student_id)
    );
end;
$$;

create function lozzi_private.shares_institution(target_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.institution_memberships caller_membership
    join public.institution_memberships target_membership
      on target_membership.institution_id = caller_membership.institution_id
    where caller_membership.user_id = caller_id
      and caller_membership.status = 'active'
      and caller_membership.deactivated_at is null
      and target_membership.user_id = target_user_id
      and target_membership.status = 'active'
      and target_membership.deactivated_at is null
  );
end;
$$;

create function lozzi_private.resolve_share_scope(
  presented_token_hash bytea,
  requested_scope text
)
returns table (
  grant_id uuid,
  student_id uuid,
  academic_record_version_id uuid,
  approved_scope text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    share_grant.id,
    share_grant.student_id,
    share_grant.academic_record_version_id,
    requested_scope
  from public.record_share_grants share_grant
  where share_grant.token_hash = presented_token_hash
    and share_grant.status = 'active'
    and share_grant.revoked_at is null
    and share_grant.expires_at > now()
    and requested_scope = any (share_grant.scopes)
  limit 1
$$;

revoke all on all functions in schema lozzi_private from public, anon, authenticated;
grant execute on function lozzi_private.has_membership(uuid, text[]) to authenticated, service_role;
grant execute on function lozzi_private.is_student_self(uuid) to authenticated, service_role;
grant execute on function lozzi_private.is_assigned_advisor(uuid) to authenticated, service_role;
grant execute on function lozzi_private.is_section_instructor(uuid) to authenticated, service_role;
grant execute on function lozzi_private.can_view_student(uuid) to authenticated, service_role;
grant execute on function lozzi_private.can_view_academic_record(uuid) to authenticated, service_role;
grant execute on function lozzi_private.shares_institution(uuid) to authenticated, service_role;
grant execute on function lozzi_private.resolve_share_scope(bytea, text) to service_role;

do $$
declare
  table_name text;
  table_names text[] := array[
    'institutions', 'profiles', 'institution_memberships', 'staff_role_assignments',
    'students', 'student_wallets', 'student_verifications', 'departments',
    'academic_terms', 'programs', 'program_versions', 'program_requirements',
    'student_programs', 'courses', 'course_prerequisites', 'course_sections',
    'section_instructors', 'section_meetings', 'enrollments', 'grade_submissions',
    'grade_records', 'academic_record_versions', 'record_documents',
    'degree_audit_snapshots', 'advisor_assignments', 'advisor_notes', 'student_holds',
    'record_share_grants', 'record_share_access_logs', 'ens_identities',
    'world_verifications', 'zero_g_objects', 'ai_inference_runs',
    'blockchain_anchors', 'integration_capabilities', 'audit_events',
    'idempotency_keys', 'outbox_events'
  ];
begin
  foreach table_name in array table_names loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format(
      'revoke all on table public.%I from public, anon, authenticated, service_role',
      table_name
    );
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end;
$$;

create policy institutions_member_select
on public.institutions for select to authenticated
using (lozzi_private.has_membership(id, null));

create policy profiles_same_institution_select
on public.profiles for select to authenticated
using (id = auth.uid() or lozzi_private.shares_institution(id));

create policy profiles_self_update
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy memberships_scoped_select
on public.institution_memberships for select to authenticated
using (
  user_id = auth.uid()
  or lozzi_private.has_membership(
    institution_id,
    array['registrar', 'institution_admin']
  )
);

create policy staff_roles_scoped_select
on public.staff_role_assignments for select to authenticated
using (
  user_id = auth.uid()
  or lozzi_private.has_membership(
    institution_id,
    array['registrar', 'institution_admin']
  )
);

create policy students_authorized_select
on public.students for select to authenticated
using (lozzi_private.can_view_student(id));

create policy student_wallets_authorized_select
on public.student_wallets for select to authenticated
using (lozzi_private.can_view_academic_record(student_id));

create policy student_verifications_authorized_select
on public.student_verifications for select to authenticated
using (lozzi_private.can_view_academic_record(student_id));

create policy departments_member_select
on public.departments for select to authenticated
using (lozzi_private.has_membership(institution_id, null));

create policy academic_terms_member_select
on public.academic_terms for select to authenticated
using (lozzi_private.has_membership(institution_id, null));

create policy programs_member_select
on public.programs for select to authenticated
using (lozzi_private.has_membership(institution_id, null));

create policy program_versions_member_select
on public.program_versions for select to authenticated
using (lozzi_private.has_membership(institution_id, null));

create policy program_requirements_member_select
on public.program_requirements for select to authenticated
using (lozzi_private.has_membership(institution_id, null));

create policy student_programs_authorized_select
on public.student_programs for select to authenticated
using (lozzi_private.can_view_academic_record(student_id));

create policy courses_member_select
on public.courses for select to authenticated
using (lozzi_private.has_membership(institution_id, null));

create policy course_prerequisites_member_select
on public.course_prerequisites for select to authenticated
using (lozzi_private.has_membership(institution_id, null));

create policy course_sections_member_select
on public.course_sections for select to authenticated
using (lozzi_private.has_membership(institution_id, null));

create policy section_instructors_member_select
on public.section_instructors for select to authenticated
using (lozzi_private.has_membership(institution_id, null));

create policy section_meetings_member_select
on public.section_meetings for select to authenticated
using (lozzi_private.has_membership(institution_id, null));

create policy enrollments_authorized_select
on public.enrollments for select to authenticated
using (
  lozzi_private.can_view_student(student_id)
  and (
    lozzi_private.can_view_academic_record(student_id)
    or lozzi_private.is_section_instructor(section_id)
  )
);

create policy grade_submissions_authorized_select
on public.grade_submissions for select to authenticated
using (
  exists (
    select 1
    from public.enrollments enrollment
    where enrollment.id = grade_submissions.enrollment_id
      and (
        lozzi_private.can_view_academic_record(enrollment.student_id)
        or lozzi_private.is_section_instructor(enrollment.section_id)
      )
  )
);

create policy grade_records_authorized_select
on public.grade_records for select to authenticated
using (
  exists (
    select 1
    from public.enrollments enrollment
    where enrollment.id = grade_records.enrollment_id
      and lozzi_private.can_view_academic_record(enrollment.student_id)
  )
);

create policy academic_record_versions_authorized_select
on public.academic_record_versions for select to authenticated
using (lozzi_private.can_view_academic_record(student_id));

create policy record_documents_authorized_select
on public.record_documents for select to authenticated
using (
  exists (
    select 1
    from public.academic_record_versions record_version
    where record_version.id = record_documents.academic_record_version_id
      and lozzi_private.can_view_academic_record(record_version.student_id)
  )
);

create policy degree_audit_snapshots_authorized_select
on public.degree_audit_snapshots for select to authenticated
using (lozzi_private.can_view_academic_record(student_id));

create policy advisor_assignments_authorized_select
on public.advisor_assignments for select to authenticated
using (
  lozzi_private.can_view_academic_record(student_id)
  or exists (
    select 1
    from public.staff_role_assignments staff_role
    where staff_role.id = advisor_assignments.advisor_role_assignment_id
      and staff_role.user_id = auth.uid()
  )
);

create policy advisor_notes_advisor_select
on public.advisor_notes for select to authenticated
using (
  lozzi_private.has_membership(
    institution_id,
    array['registrar', 'institution_admin']
  )
  or exists (
    select 1
    from public.staff_role_assignments staff_role
    where staff_role.id = advisor_notes.advisor_role_assignment_id
      and staff_role.user_id = auth.uid()
      and staff_role.role = 'advisor'
  )
);

create policy student_holds_authorized_select
on public.student_holds for select to authenticated
using (lozzi_private.can_view_academic_record(student_id));

create policy record_share_grants_authorized_select
on public.record_share_grants for select to authenticated
using (lozzi_private.can_view_academic_record(student_id));

create policy record_share_access_logs_authorized_select
on public.record_share_access_logs for select to authenticated
using (
  exists (
    select 1
    from public.record_share_grants share_grant
    where share_grant.id = record_share_access_logs.share_grant_id
      and lozzi_private.can_view_academic_record(share_grant.student_id)
  )
);

create policy ens_identities_authorized_select
on public.ens_identities for select to authenticated
using (
  student_id is not null
  and lozzi_private.can_view_academic_record(student_id)
);

create policy world_verifications_authorized_select
on public.world_verifications for select to authenticated
using (lozzi_private.can_view_academic_record(student_id));

create policy zero_g_objects_authorized_select
on public.zero_g_objects for select to authenticated
using (
  owner_student_id is not null
  and lozzi_private.can_view_academic_record(owner_student_id)
);

create policy ai_inference_runs_authorized_select
on public.ai_inference_runs for select to authenticated
using (lozzi_private.can_view_academic_record(student_id));

create policy blockchain_anchors_authorized_select
on public.blockchain_anchors for select to authenticated
using (
  academic_record_version_id is not null
  and exists (
    select 1
    from public.academic_record_versions record_version
    where record_version.id = blockchain_anchors.academic_record_version_id
      and lozzi_private.can_view_academic_record(record_version.student_id)
  )
);

create policy integration_capabilities_member_select
on public.integration_capabilities for select to authenticated
using (lozzi_private.has_membership(institution_id, null));

create policy audit_events_privileged_select
on public.audit_events for select to authenticated
using (
  institution_id is not null
  and lozzi_private.has_membership(
    institution_id,
    array['registrar', 'institution_admin']
  )
);

grant select on table
  public.institutions,
  public.profiles,
  public.institution_memberships,
  public.staff_role_assignments,
  public.students,
  public.student_wallets,
  public.student_verifications,
  public.departments,
  public.academic_terms,
  public.programs,
  public.program_versions,
  public.program_requirements,
  public.student_programs,
  public.courses,
  public.course_prerequisites,
  public.course_sections,
  public.section_instructors,
  public.section_meetings,
  public.enrollments,
  public.grade_submissions,
  public.grade_records,
  public.academic_record_versions,
  public.record_documents,
  public.degree_audit_snapshots,
  public.advisor_assignments,
  public.advisor_notes,
  public.student_holds,
  public.record_share_grants,
  public.record_share_access_logs,
  public.ens_identities,
  public.world_verifications,
  public.zero_g_objects,
  public.ai_inference_runs,
  public.blockchain_anchors,
  public.integration_capabilities,
  public.audit_events
to authenticated;

grant update (display_name, initials, locale, updated_at)
on table public.profiles to authenticated;

create view public.student_dashboard_summary
with (security_invoker = true)
as
select
  student.id as student_id,
  student.user_id,
  student.institution_id,
  profile.display_name,
  profile.initials,
  institution.name as institution_name,
  program.name as program_name,
  student.academic_status,
  coalesce(audit.gpa, 0)::numeric(4, 2) as gpa,
  coalesce(audit.credits_earned, 0)::numeric(6, 2) as credits_earned,
  coalesce(audit.credits_required, program_version.required_credits)::numeric(6, 2) as credits_required,
  coalesce(audit.progress_percent, 0)::numeric(5, 2) as progress_percent,
  (
    select count(*)::integer
    from public.student_holds hold
    where hold.student_id = student.id
      and hold.status = 'active'
      and hold.is_blocking
  ) as active_hold_count,
  (
    select count(*)::integer
    from public.advisor_notes note
    where note.student_id = student.id
      and note.status = 'active'
  ) as private_advisor_note_count,
  (
    select count(*)::integer
    from public.record_share_grants share_grant
    where share_grant.student_id = student.id
      and share_grant.status = 'active'
      and share_grant.expires_at > now()
  ) as active_share_count
from public.students student
join public.profiles profile on profile.id = student.user_id
join public.institutions institution on institution.id = student.institution_id
join public.student_programs student_program
  on student_program.student_id = student.id
  and student_program.status = 'active'
join public.program_versions program_version
  on program_version.id = student_program.program_version_id
join public.programs program on program.id = program_version.program_id
left join lateral (
  select snapshot.gpa, snapshot.credits_earned, snapshot.credits_required, snapshot.progress_percent
  from public.degree_audit_snapshots snapshot
  where snapshot.student_id = student.id
  order by snapshot.calculated_at desc
  limit 1
) audit on true;

create view public.student_current_courses
with (security_invoker = true)
as
select
  enrollment.student_id,
  course.code,
  course.title,
  section.section_code,
  section.id as section_id,
  coalesce(meeting.schedule, 'Schedule to be announced') as schedule,
  coalesce(section.location, 'To be announced') as location,
  coalesce(instructor_names.names, 'Staff') as instructor
from public.enrollments enrollment
join public.course_sections section on section.id = enrollment.section_id
join public.courses course on course.id = section.course_id
left join lateral (
  select string_agg(
    to_char(section_meeting.starts_at, 'HH12:MI AM')
      || '–'
      || to_char(section_meeting.ends_at, 'HH12:MI AM'),
    ', '
    order by section_meeting.weekday, section_meeting.starts_at
  ) as schedule
  from public.section_meetings section_meeting
  where section_meeting.section_id = section.id
) meeting on true
left join lateral (
  select string_agg(profile.display_name, ', ' order by profile.display_name) as names
  from public.section_instructors section_instructor
  join public.staff_role_assignments staff_role
    on staff_role.id = section_instructor.staff_role_assignment_id
  join public.profiles profile on profile.id = staff_role.user_id
  where section_instructor.section_id = section.id
) instructor_names on true
where enrollment.status = 'enrolled';

create view public.student_recent_activity
with (security_invoker = true)
as
select
  enrollment.student_id,
  enrollment.id as activity_id,
  'Enrollment confirmed'::text as title,
  course.code || ' · ' || course.title as detail,
  enrollment.enrolled_at as occurred_at,
  'teal'::text as tone
from public.enrollments enrollment
join public.course_sections section on section.id = enrollment.section_id
join public.courses course on course.id = section.course_id
where enrollment.status = 'enrolled'
union all
select
  enrollment.student_id,
  grade_record.id as activity_id,
  'Academic record published'::text as title,
  course.code || ' was added to your verified history' as detail,
  grade_record.published_at as occurred_at,
  'gold'::text as tone
from public.grade_records grade_record
join public.enrollments enrollment on enrollment.id = grade_record.enrollment_id
join public.course_sections section on section.id = enrollment.section_id
join public.courses course on course.id = section.course_id
where grade_record.is_current;

revoke all on public.student_dashboard_summary from public, anon, authenticated, service_role;
revoke all on public.student_current_courses from public, anon, authenticated, service_role;
revoke all on public.student_recent_activity from public, anon, authenticated, service_role;
grant select on public.student_dashboard_summary to authenticated, service_role;
grant select on public.student_current_courses to authenticated, service_role;
grant select on public.student_recent_activity to authenticated, service_role;

do $$
declare
  table_name text;
  table_names text[] := array[
    'institutions', 'profiles', 'institution_memberships', 'staff_role_assignments',
    'students', 'student_wallets', 'student_verifications', 'departments',
    'academic_terms', 'programs', 'program_versions', 'program_requirements',
    'student_programs', 'courses', 'course_prerequisites', 'course_sections',
    'section_instructors', 'section_meetings', 'enrollments', 'grade_submissions',
    'record_documents', 'advisor_assignments', 'advisor_notes', 'student_holds',
    'record_share_grants', 'ens_identities', 'world_verifications',
    'zero_g_objects', 'blockchain_anchors', 'integration_capabilities',
    'outbox_events'
  ];
begin
  foreach table_name in array table_names loop
    execute format(
      'create trigger set_%I_updated_at before update on public.%I
       for each row execute function lozzi_private.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end;
$$;
