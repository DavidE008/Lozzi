create function lozzi_private.has_active_staff_role(
  target_institution_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.institution_memberships membership
      join public.staff_role_assignments assignment
        on assignment.institution_id = membership.institution_id
        and assignment.user_id = membership.user_id
        and assignment.role = membership.role
      where membership.institution_id = target_institution_id
        and membership.user_id = (select auth.uid())
        and membership.role = any (allowed_roles)
        and membership.status = 'active'
        and membership.deactivated_at is null
        and assignment.status = 'active'
        and assignment.deactivated_at is null
        and assignment.valid_from <= now()
        and (assignment.valid_until is null or assignment.valid_until > now())
    )
$$;

create function lozzi_private.set_actor_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is not null then
    if tg_op = 'INSERT' then
      new.created_by := caller_id;
    end if;
    new.updated_by := caller_id;
  end if;

  return new;
end;
$$;

revoke all on function lozzi_private.has_active_staff_role(uuid, text[])
from public, anon, authenticated, service_role;
revoke all on function lozzi_private.set_actor_columns()
from public, anon, authenticated, service_role;
grant execute on function lozzi_private.has_active_staff_role(uuid, text[])
to authenticated, service_role;

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
      'create trigger set_%I_actor before insert or update on public.%I
       for each row execute function lozzi_private.set_actor_columns()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

create policy institutions_admin_update
on public.institutions for update to authenticated
using (
  lozzi_private.has_active_staff_role(
    id,
    array['institution_admin']
  )
)
with check (
  lozzi_private.has_active_staff_role(
    id,
    array['institution_admin']
  )
);

create policy memberships_admin_insert
on public.institution_memberships for insert to authenticated
with check (
  lozzi_private.has_active_staff_role(
    institution_id,
    array['institution_admin']
  )
);

create policy memberships_admin_update
on public.institution_memberships for update to authenticated
using (
  lozzi_private.has_active_staff_role(
    institution_id,
    array['institution_admin']
  )
)
with check (
  lozzi_private.has_active_staff_role(
    institution_id,
    array['institution_admin']
  )
);

create policy staff_roles_admin_insert
on public.staff_role_assignments for insert to authenticated
with check (
  lozzi_private.has_active_staff_role(
    institution_id,
    array['institution_admin']
  )
);

create policy staff_roles_admin_update
on public.staff_role_assignments for update to authenticated
using (
  lozzi_private.has_active_staff_role(
    institution_id,
    array['institution_admin']
  )
)
with check (
  lozzi_private.has_active_staff_role(
    institution_id,
    array['institution_admin']
  )
);

do $$
declare
  table_name text;
  table_names text[] := array[
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
      'create policy %I on public.%I for insert to authenticated
       with check (
         lozzi_private.has_active_staff_role(
           institution_id,
           array[''registrar'', ''institution_admin'']
         )
       )',
      table_name || '_manager_insert',
      table_name
    );

    execute format(
      'create policy %I on public.%I for update to authenticated
       using (
         lozzi_private.has_active_staff_role(
           institution_id,
           array[''registrar'', ''institution_admin'']
         )
       )
       with check (
         lozzi_private.has_active_staff_role(
           institution_id,
           array[''registrar'', ''institution_admin'']
         )
       )',
      table_name || '_manager_update',
      table_name
    );
  end loop;
end;
$$;

grant update (name)
on table public.institutions to authenticated;

grant insert (institution_id, user_id, role, status, deactivated_at)
on table public.institution_memberships to authenticated;
grant update (status, deactivated_at)
on table public.institution_memberships to authenticated;

grant insert (
  institution_id,
  user_id,
  role,
  status,
  valid_from,
  valid_until,
  deactivated_at
)
on table public.staff_role_assignments to authenticated;
grant update (
  status,
  valid_until,
  deactivated_at
)
on table public.staff_role_assignments to authenticated;

grant insert (
  institution_id,
  parent_department_id,
  code,
  name,
  status,
  deactivated_at
)
on table public.departments to authenticated;

grant insert (
  institution_id,
  code,
  name,
  starts_on,
  ends_on,
  registration_opens_at,
  registration_closes_at,
  add_drop_deadline,
  withdrawal_deadline,
  grades_due_at,
  status,
  max_credits,
  min_credits,
  deactivated_at
)
on table public.academic_terms to authenticated;

grant insert (
  institution_id,
  department_id,
  code,
  name,
  credential_type,
  status,
  deactivated_at
)
on table public.programs to authenticated;

grant insert (
  institution_id,
  program_id,
  version_number,
  effective_term_id,
  required_credits,
  status,
  published_at
)
on table public.program_versions to authenticated;

grant insert (
  institution_id,
  program_version_id,
  course_id,
  requirement_group,
  minimum_credits,
  sort_order,
  rule_config,
  deactivated_at
)
on table public.program_requirements to authenticated;

grant insert (
  institution_id,
  department_id,
  code,
  title,
  description,
  credit_hours,
  repeat_policy,
  status,
  deactivated_at
)
on table public.courses to authenticated;

grant insert (
  institution_id,
  course_id,
  prerequisite_course_id,
  minimum_grade_points,
  kind,
  deactivated_at
)
on table public.course_prerequisites to authenticated;

grant insert (
  institution_id,
  course_id,
  term_id,
  section_code,
  capacity,
  enrolled_count,
  location,
  delivery_mode,
  status,
  deactivated_at
)
on table public.course_sections to authenticated;

grant insert (
  institution_id,
  section_id,
  staff_role_assignment_id,
  is_primary,
  deactivated_at
)
on table public.section_instructors to authenticated;

grant insert (
  institution_id,
  section_id,
  weekday,
  starts_at,
  ends_at,
  location,
  starts_on,
  ends_on,
  deactivated_at
)
on table public.section_meetings to authenticated;

grant update (
  parent_department_id,
  code,
  name,
  status,
  deactivated_at
)
on table public.departments to authenticated;

grant update (
  code,
  name,
  starts_on,
  ends_on,
  registration_opens_at,
  registration_closes_at,
  add_drop_deadline,
  withdrawal_deadline,
  grades_due_at,
  status,
  max_credits,
  min_credits,
  deactivated_at
)
on table public.academic_terms to authenticated;

grant update (
  department_id,
  code,
  name,
  credential_type,
  status,
  deactivated_at
)
on table public.programs to authenticated;

grant update (
  effective_term_id,
  required_credits,
  status,
  published_at
)
on table public.program_versions to authenticated;

grant update (
  course_id,
  requirement_group,
  minimum_credits,
  sort_order,
  rule_config,
  deactivated_at
)
on table public.program_requirements to authenticated;

grant update (
  department_id,
  code,
  title,
  description,
  credit_hours,
  repeat_policy,
  status,
  deactivated_at
)
on table public.courses to authenticated;

grant update (
  minimum_grade_points,
  kind,
  deactivated_at
)
on table public.course_prerequisites to authenticated;

grant update (
  course_id,
  term_id,
  section_code,
  capacity,
  location,
  delivery_mode,
  status,
  deactivated_at
)
on table public.course_sections to authenticated;

grant update (
  is_primary,
  deactivated_at
)
on table public.section_instructors to authenticated;

grant update (
  weekday,
  starts_at,
  ends_at,
  location,
  starts_on,
  ends_on,
  deactivated_at
)
on table public.section_meetings to authenticated;
