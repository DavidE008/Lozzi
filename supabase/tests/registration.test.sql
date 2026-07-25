begin;

select plan(20);

select has_view(
  'public',
  'registrar_registration_activity',
  'registrar registration activity view exists'
);

select ok(
  'security_invoker=true' = any (
    select unnest(reloptions)
    from pg_class
    where oid = 'public.registrar_registration_activity'::regclass
  ),
  'registrar registration activity uses security_invoker'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000101';

select is(
  (select count(*)::bigint from public.get_registration_catalog()),
  6::bigint,
  'Aisha receives the six Fall registration offerings'
);

select ok(
  (
    public.check_registration_eligibility(
      '60000000-0000-4000-8000-000000000001'
    ) ->> 'eligible'
  )::boolean = false,
  'an existing enrollment is not eligible again'
);

select ok(
  public.check_registration_eligibility(
    '60000000-0000-4000-8000-000000000001'
  ) -> 'blockingReasons' @> '[{"code":"DUPLICATE_ENROLLMENT"}]'::jsonb,
  'duplicate enrollment returns a stable blocking code'
);

select ok(
  (
    public.check_registration_eligibility(
      '60000000-0000-4000-8000-000000000004'
    ) ->> 'eligible'
  )::boolean,
  'Aisha is eligible for Calculus I'
);

select ok(
  public.check_registration_eligibility(
    '60000000-0000-4000-8000-000000000003'
  ) -> 'blockingReasons' @> '[{"code":"MISSING_PREREQUISITE"}]'::jsonb,
  'Aisha is blocked from Algorithms without completed Data Structures'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000103';

select ok(
  public.check_registration_eligibility(
    '60000000-0000-4000-8000-000000000004'
  ) -> 'blockingReasons' @> '[{"code":"BLOCKING_HOLD"}]'::jsonb,
  'Priya receives a blocking hold result'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000102';

select ok(
  (
    public.check_registration_eligibility(
      '60000000-0000-4000-8000-000000000001'
    ) ->> 'eligible'
  )::boolean,
  'Mateo is eligible for the final Data Structures seat'
);

select ok(
  (
    public.register_for_sections(
      array['60000000-0000-4000-8000-000000000001'::uuid],
      '90000000-0000-4000-8000-000000000001'
    ) ->> 'success'
  )::boolean,
  'an eligible registration succeeds'
);

select is(
  (
    select enrolled_count
    from public.course_sections
    where id = '60000000-0000-4000-8000-000000000001'
  ),
  2,
  'registration atomically consumes the final seat'
);

select ok(
  (
    public.register_for_sections(
      array['60000000-0000-4000-8000-000000000001'::uuid],
      '90000000-0000-4000-8000-000000000001'
    ) ->> 'idempotentReplay'
  )::boolean,
  'replaying the registration idempotency key returns the stored result'
);

select is(
  (
    select enrolled_count
    from public.course_sections
    where id = '60000000-0000-4000-8000-000000000001'
  ),
  2,
  'an idempotent replay does not consume another seat'
);

select ok(
  (
    public.withdraw_from_section(
      (
        select id
        from public.enrollments
        where student_id = '13000000-0000-4000-8000-000000000102'
          and section_id = '60000000-0000-4000-8000-000000000001'
      ),
      '90000000-0000-4000-8000-000000000002'
    ) ->> 'success'
  )::boolean,
  'a withdrawal inside the add-drop window succeeds'
);

select is(
  (
    select status
    from public.enrollments
    where student_id = '13000000-0000-4000-8000-000000000102'
      and section_id = '60000000-0000-4000-8000-000000000001'
  ),
  'dropped',
  'the enrollment records a drop before the deadline'
);

select is(
  (
    select enrolled_count
    from public.course_sections
    where id = '60000000-0000-4000-8000-000000000001'
  ),
  1,
  'withdrawal atomically releases the seat'
);

select is(
  (
    select count(*)::bigint
    from public.registration_requests
    where student_id = '13000000-0000-4000-8000-000000000102'
  ),
  2::bigint,
  'the student sees only their registration and withdrawal requests'
);

select is(
  (
    select count(*)::bigint
    from public.audit_events
    where actor_user_id = '00000000-0000-4000-8000-000000000102'
      and action in ('registration.submit', 'registration.withdraw')
      and outcome = 'success'
  ),
  0::bigint,
  'students do not receive direct audit-table access'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000201';

select is(
  (
    select count(*)::bigint
    from public.registrar_registration_activity
    where student_id = '13000000-0000-4000-8000-000000000102'
  ),
  2::bigint,
  'the registrar sees institution-scoped registration outcomes'
);

select throws_ok(
  $$ select public.get_registration_catalog() $$,
  '42501',
  'Student access required',
  'a registrar cannot invoke a student-scoped catalog RPC'
);

select * from finish();

rollback;
