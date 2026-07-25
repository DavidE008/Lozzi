-- Add a covering index for every public foreign key that does not already have one.
-- This protects delete/update checks and the assignment-heavy authorization paths.
do $$
declare
  foreign_key record;
begin
  for foreign_key in
    select
      namespace.nspname as schema_name,
      relation.relname as table_name,
      constraint_record.conname as constraint_name,
      string_agg(quote_ident(attribute.attname), ', ' order by key_column.ordinality) as columns
    from pg_constraint constraint_record
    join pg_class relation
      on relation.oid = constraint_record.conrelid
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    cross join lateral unnest(constraint_record.conkey)
      with ordinality as key_column(attribute_number, ordinality)
    join pg_attribute attribute
      on attribute.attrelid = relation.oid
      and attribute.attnum = key_column.attribute_number
    where constraint_record.contype = 'f'
      and namespace.nspname = 'public'
      and not exists (
        select 1
        from pg_index index_record
        where index_record.indrelid = constraint_record.conrelid
          and index_record.indisvalid
          and index_record.indkey::smallint[] @> constraint_record.conkey
      )
    group by
      namespace.nspname,
      relation.relname,
      constraint_record.conname
  loop
    execute format(
      'create index if not exists %I on %I.%I (%s)',
      left('idx_' || foreign_key.constraint_name, 63),
      foreign_key.schema_name,
      foreign_key.table_name,
      foreign_key.columns
    );
  end loop;
end;
$$;

drop policy if exists profiles_same_institution_select on public.profiles;
create policy profiles_same_institution_select
on public.profiles for select to authenticated
using (id = (select auth.uid()) or lozzi_private.shares_institution(id));

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists memberships_scoped_select on public.institution_memberships;
create policy memberships_scoped_select
on public.institution_memberships for select to authenticated
using (
  user_id = (select auth.uid())
  or lozzi_private.has_membership(
    institution_id,
    array['registrar', 'institution_admin']
  )
);

drop policy if exists staff_roles_scoped_select on public.staff_role_assignments;
create policy staff_roles_scoped_select
on public.staff_role_assignments for select to authenticated
using (
  user_id = (select auth.uid())
  or lozzi_private.has_membership(
    institution_id,
    array['registrar', 'institution_admin']
  )
);

drop policy if exists advisor_assignments_authorized_select on public.advisor_assignments;
create policy advisor_assignments_authorized_select
on public.advisor_assignments for select to authenticated
using (
  lozzi_private.can_view_academic_record(student_id)
  or exists (
    select 1
    from public.staff_role_assignments staff_role
    where staff_role.id = advisor_assignments.advisor_role_assignment_id
      and staff_role.user_id = (select auth.uid())
  )
);

drop policy if exists advisor_notes_advisor_select on public.advisor_notes;
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
      and staff_role.user_id = (select auth.uid())
      and staff_role.role = 'advisor'
  )
);
