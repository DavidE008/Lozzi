begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(38);

select has_view(
  'public',
  'registrar_workspace_summary',
  'registrar summary view exists'
);
select has_view(
  'public',
  'registrar_attention_queue',
  'registrar attention queue view exists'
);
select has_view(
  'public',
  'registrar_student_directory',
  'registrar student directory view exists'
);
select has_view(
  'public',
  'registrar_section_directory',
  'registrar section directory view exists'
);
select has_view(
  'public',
  'registrar_audit_activity',
  'registrar audit activity view exists'
);

select ok(
  'security_invoker=true' = any (
    select unnest(reloptions)
    from pg_class
    where oid = 'public.registrar_workspace_summary'::regclass
  ),
  'registrar summary uses security_invoker'
);
select ok(
  'security_invoker=true' = any (
    select unnest(reloptions)
    from pg_class
    where oid = 'public.registrar_attention_queue'::regclass
  ),
  'registrar attention queue uses security_invoker'
);
select ok(
  'security_invoker=true' = any (
    select unnest(reloptions)
    from pg_class
    where oid = 'public.registrar_student_directory'::regclass
  ),
  'registrar student directory uses security_invoker'
);
select ok(
  'security_invoker=true' = any (
    select unnest(reloptions)
    from pg_class
    where oid = 'public.registrar_section_directory'::regclass
  ),
  'registrar section directory uses security_invoker'
);
select ok(
  'security_invoker=true' = any (
    select unnest(reloptions)
    from pg_class
    where oid = 'public.registrar_audit_activity'::regclass
  ),
  'registrar audit activity uses security_invoker'
);

select ok(
  not has_table_privilege(
    'anon',
    'public.registrar_workspace_summary',
    'select'
  ),
  'anonymous users cannot read the registrar summary'
);
select ok(
  has_table_privilege(
    'authenticated',
    'public.registrar_workspace_summary',
    'select'
  ),
  'authenticated users receive an explicit registrar view grant'
);
select ok(
  not has_table_privilege('authenticated', 'public.departments', 'delete'),
  'academic administration has no destructive delete grant'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.departments',
    'created_by',
    'insert'
  ),
  'clients cannot forge department creator audit fields'
);

insert into public.institutions (id, slug, name)
values (
  '10000000-0000-4000-8000-000000000099',
  'milestone-two-other-university',
  'Milestone Two Other University'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000101';

select is(
  (select count(*)::bigint from public.registrar_workspace_summary),
  0::bigint,
  'students receive no registrar summary rows'
);
select throws_ok(
  $$
    insert into public.departments (institution_id, code, name)
    values (
      '10000000-0000-4000-8000-000000000001',
      'STUDENT-DENIED',
      'Student denied department'
    )
  $$,
  '42501',
  null,
  'students cannot create academic structure'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000202';

select is(
  (select count(*)::bigint from public.registrar_workspace_summary),
  0::bigint,
  'instructors receive no registrar summary rows'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000204';

select is(
  (select count(*)::bigint from public.registrar_workspace_summary),
  0::bigint,
  'advisors receive no registrar summary rows'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000201';

select is(
  (select count(*)::bigint from public.registrar_workspace_summary),
  1::bigint,
  'the registrar receives one institution-scoped summary'
);
select is(
  (select active_student_count from public.registrar_workspace_summary),
  3,
  'the registrar summary reports three active synthetic students'
);
select is(
  (select course_section_count from public.registrar_workspace_summary),
  2,
  'the registrar summary reports two synthetic course sections'
);
select is(
  (
    select records_awaiting_publication
    from public.registrar_workspace_summary
  ),
  1,
  'the registrar summary reports one approved unpublished record'
);
select is(
  (select count(*)::bigint from public.registrar_attention_queue),
  1::bigint,
  'the registrar sees the single synthetic review item'
);
select is(
  (select count(*)::bigint from public.registrar_student_directory),
  3::bigint,
  'the registrar directory is institution scoped to three students'
);
select is(
  (select count(*)::bigint from public.registrar_section_directory),
  2::bigint,
  'the registrar section directory exposes both seeded sections'
);

select lives_ok(
  $$
    insert into public.departments (
      institution_id,
      code,
      name
    )
    values (
      '10000000-0000-4000-8000-000000000001',
      'M2-TEST',
      'Milestone Two Test'
    )
  $$,
  'a registrar can create an institution-scoped department'
);
select is(
  (
    select created_by
    from public.departments
    where code = 'M2-TEST'
  ),
  '00000000-0000-4000-8000-000000000201'::uuid,
  'the database derives the department creator from auth.uid()'
);
select lives_ok(
  $$
    update public.departments
    set name = 'Milestone Two Updated'
    where code = 'M2-TEST'
  $$,
  'a registrar can update an institution-scoped department'
);
select is(
  (
    select count(*)::bigint
    from public.audit_events
    where action = 'departments.updated'
      and entity_id = (
        select id from public.departments where code = 'M2-TEST'
      )
  ),
  1::bigint,
  'department updates append a scoped audit event'
);
select lives_ok(
  $$
    update public.departments
    set status = 'inactive', deactivated_at = now()
    where code = 'M2-TEST'
  $$,
  'a registrar deactivates academic structure instead of deleting it'
);
select is(
  (
    select count(*)::bigint
    from public.audit_events
    where action = 'departments.deactivated'
      and entity_id = (
        select id from public.departments where code = 'M2-TEST'
      )
  ),
  1::bigint,
  'department deactivation appends a distinct audit event'
);
update public.institutions
set name = 'Registrar should not change this'
where id = '10000000-0000-4000-8000-000000000001';

select is(
  (
    select name
    from public.institutions
    where id = '10000000-0000-4000-8000-000000000001'
  ),
  'Northstar University',
  'registrars cannot modify institution settings'
);

update public.institution_memberships
set status = 'inactive', deactivated_at = now()
where institution_id = '10000000-0000-4000-8000-000000000001'
  and user_id = '00000000-0000-4000-8000-000000000101'
  and role = 'student';

select is(
  (
    select status
    from public.institution_memberships
    where institution_id = '10000000-0000-4000-8000-000000000001'
      and user_id = '00000000-0000-4000-8000-000000000101'
      and role = 'student'
  ),
  'active',
  'registrars cannot modify memberships'
);
select throws_ok(
  $$
    insert into public.departments (institution_id, code, name)
    values (
      '10000000-0000-4000-8000-000000000099',
      'CROSS-TENANT',
      'Cross tenant department'
    )
  $$,
  '42501',
  null,
  'registrars cannot create academic structure in another institution'
);

reset role;

insert into public.institution_memberships (
  id,
  institution_id,
  user_id,
  role
)
values (
  '20000000-0000-4000-8000-000000000299',
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000201',
  'institution_admin'
);

insert into public.staff_role_assignments (
  id,
  institution_id,
  user_id,
  role,
  valid_from
)
values (
  '21000000-0000-4000-8000-000000000299',
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000201',
  'institution_admin',
  '2026-01-01 00:00:00+00'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000201';

select lives_ok(
  $$
    update public.institutions
    set name = 'Northstar University — Admin verified'
    where id = '10000000-0000-4000-8000-000000000001'
  $$,
  'an active institution administrator can update institution settings'
);
select is(
  (
    select updated_by
    from public.institutions
    where id = '10000000-0000-4000-8000-000000000001'
  ),
  '00000000-0000-4000-8000-000000000201'::uuid,
  'the institution update actor is derived from auth.uid()'
);

reset role;

update public.staff_role_assignments
set status = 'inactive', deactivated_at = now()
where institution_id = '10000000-0000-4000-8000-000000000001'
  and user_id = '00000000-0000-4000-8000-000000000201'
  and role in ('registrar', 'institution_admin');

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000201';

select throws_ok(
  $$
    insert into public.departments (institution_id, code, name)
    values (
      '10000000-0000-4000-8000-000000000001',
      'INACTIVE-DENIED',
      'Inactive assignment denied'
    )
  $$,
  '42501',
  null,
  'inactive staff assignments cannot authorize academic writes'
);
select is(
  (
    select count(*)::bigint
    from public.audit_events
    where metadata <> '{"source": "registrar_workspace"}'::jsonb
      and entity_type in (
        'departments',
        'institutions',
        'institution_memberships',
        'staff_role_assignments'
      )
  ),
  0::bigint,
  'registrar mutation audits contain only the PII-free source marker'
);

select * from finish();
rollback;
