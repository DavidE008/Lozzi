begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(26);

select has_table('public', 'institutions', 'institutions table exists');
select has_table('public', 'students', 'students table exists');
select has_view('public', 'student_dashboard_summary', 'dashboard view exists');

select is(
  (
    select count(*)::bigint
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind = 'r'
      and relation.relname in (
        'institutions', 'profiles', 'institution_memberships', 'staff_role_assignments',
        'students', 'student_wallets', 'student_verifications', 'departments',
        'academic_terms', 'programs', 'program_versions', 'program_requirements',
        'student_programs', 'courses', 'course_prerequisites', 'course_sections',
        'section_instructors', 'section_meetings', 'enrollments', 'grade_submissions',
        'grade_records', 'academic_record_versions', 'record_documents',
        'degree_audit_snapshots', 'advisor_assignments', 'advisor_notes',
        'student_holds', 'record_share_grants', 'record_share_access_logs',
        'ens_identities', 'wallet_link_challenges', 'world_verifications',
        'zero_g_objects', 'ai_inference_runs',
        'blockchain_anchors', 'integration_capabilities', 'audit_events',
        'idempotency_keys', 'outbox_events'
      )
      and not relation.relrowsecurity
  ),
  0::bigint,
  'every exposed domain table has RLS enabled'
);

select ok(
  not has_table_privilege('anon', 'public.students', 'select'),
  'anonymous receives no student table privilege'
);
select ok(
  has_table_privilege('authenticated', 'public.students', 'select'),
  'authenticated role has an explicit student select grant'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000101';

select is(
  (select count(*)::bigint from public.students),
  1::bigint,
  'student can see only their own student row'
);
select is(
  (select count(*)::bigint from public.students where id = '13000000-0000-4000-8000-000000000102'),
  0::bigint,
  'student cannot query another student'
);
select is(
  (select gpa::text from public.student_dashboard_summary),
  '4.00',
  'student reads the real seeded 4.00 dashboard GPA'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000202';

select is(
  (
    select count(*)::bigint
    from public.enrollments
    where section_id = '60000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'assigned instructor can view their section roster'
);
select is(
  (
    select count(*)::bigint
    from public.students
    where id = '13000000-0000-4000-8000-000000000101'
  ),
  1::bigint,
  'assigned instructor can view the roster student profile'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000203';

select is(
  (select count(*)::bigint from public.enrollments),
  0::bigint,
  'unrelated instructor receives no roster rows'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000204';

select is(
  (
    select count(*)::bigint
    from public.students
    where id = '13000000-0000-4000-8000-000000000101'
  ),
  1::bigint,
  'assigned advisor can view Aisha'
);
select is(
  (
    select count(*)::bigint
    from public.students
    where id = '13000000-0000-4000-8000-000000000102'
  ),
  0::bigint,
  'assigned advisor cannot view an unassigned student'
);

reset role;
insert into public.institutions (id, slug, name)
values ('10000000-0000-4000-8000-000000000099', 'test-other-university', 'Test Other University');
insert into public.students (
  id,
  institution_id,
  user_id,
  student_number,
  pseudonymous_id
)
values (
  '13000000-0000-4000-8000-000000000099',
  '10000000-0000-4000-8000-000000000099',
  '00000000-0000-4000-8000-000000000102',
  'OTHER-1',
  'urn:lozzi:student:other'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000201';

select is(
  (
    select count(*)::bigint
    from public.students
    where institution_id = '10000000-0000-4000-8000-000000000001'
  ),
  3::bigint,
  'registrar can view students in their institution'
);
select is(
  (
    select count(*)::bigint
    from public.students
    where institution_id = '10000000-0000-4000-8000-000000000099'
  ),
  0::bigint,
  'registrar cannot cross institution boundaries'
);

reset role;
set local role service_role;

select is(
  (
    select count(*)::bigint
    from lozzi_private.resolve_share_scope(
      digest('lozzi-valid-demo-token', 'sha256'),
      'program'
    )
  ),
  1::bigint,
  'valid share resolves an allowed scope'
);
select is(
  (
    select count(*)::bigint
    from lozzi_private.resolve_share_scope(
      digest('lozzi-valid-demo-token', 'sha256'),
      'grades'
    )
  ),
  0::bigint,
  'valid share cannot exceed its scopes'
);
select is(
  (
    select count(*)::bigint
    from lozzi_private.resolve_share_scope(
      digest('lozzi-expired-demo-token', 'sha256'),
      'program'
    )
  ),
  0::bigint,
  'expired share resolves no fields'
);
select is(
  (
    select count(*)::bigint
    from lozzi_private.resolve_share_scope(
      digest('lozzi-revoked-demo-token', 'sha256'),
      'program'
    )
  ),
  0::bigint,
  'revoked share resolves no fields'
);

reset role;

select ok(
  'security_invoker=true' = any (
    select unnest(reloptions)
    from pg_class
    where oid = 'public.student_dashboard_summary'::regclass
  ),
  'dashboard view uses security_invoker'
);
select ok(
  'security_invoker=true' = any (
    select unnest(reloptions)
    from pg_class
    where oid = 'public.student_current_courses'::regclass
  ),
  'current courses view uses security_invoker'
);
select ok(
  'security_invoker=true' = any (
    select unnest(reloptions)
    from pg_class
    where oid = 'public.student_recent_activity'::regclass
  ),
  'recent activity view uses security_invoker'
);
select ok(
  not has_function_privilege(
    'anon',
    'lozzi_private.resolve_share_scope(bytea,text)',
    'execute'
  ),
  'anonymous cannot execute the privileged share resolver'
);
select ok(
  not has_schema_privilege('anon', 'lozzi_private', 'usage'),
  'anonymous cannot access the private schema'
);
select ok(
  not has_table_privilege('authenticated', 'public.outbox_events', 'select'),
  'authenticated users cannot inspect the outbox'
);

select * from finish();
rollback;
