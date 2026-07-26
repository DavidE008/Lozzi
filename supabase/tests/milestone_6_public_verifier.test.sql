begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(22);

select has_column(
  'public',
  'record_share_grants',
  'disclosure_payload',
  'share grants freeze an offchain disclosure package'
);
select has_table(
  'lozzi_private',
  'public_verifier_attempts',
  'public verifier abuse attempts are tracked privately'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.verify_record_share(bytea,bytea)',
    'execute'
  ),
  'the secure server boundary can resolve a public share'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.verify_record_share(bytea,bytea)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.verify_record_share(bytea,bytea)',
    'execute'
  ),
  'browser roles cannot call the share resolver directly'
);
select ok(
  not has_table_privilege(
    'service_role',
    'lozzi_private.public_verifier_attempts',
    'select'
  ),
  'even the service role cannot inspect raw verifier abuse records'
);

set local role service_role;

select is(
  public.verify_record_share(
    digest('lozzi-valid-demo-token', 'sha256'),
    decode(repeat('a1', 32), 'hex')
  ) ->> 'status',
  'locally_verified',
  'a valid local disclosure is honestly labelled as local'
);

reset role;

select is(
  (
    select disclosure_payload
    from public.record_share_grants
    where id = '77000000-0000-4000-8000-000000000001'
  ),
  (
    select jsonb_build_object(
      'degree-progress',
      disclosure_payload -> 'degree-progress',
      'program',
      disclosure_payload -> 'program'
    )
    from public.record_share_grants
    where id = '77000000-0000-4000-8000-000000000001'
  ),
  'the frozen package contains exactly the selected scopes'
);
select ok(
  not (
    (
      select disclosure_payload
      from public.record_share_grants
      where id = '77000000-0000-4000-8000-000000000001'
    ) ?| array['record-summary', 'full-record']
  ),
  'unselected academic sections are absent from the package'
);
select throws_ok(
  $test$
    update public.record_share_grants
    set disclosure_payload = disclosure_payload ||
      '{"full-record":[]}'::jsonb
    where id = '77000000-0000-4000-8000-000000000001'
  $test$,
  '23514',
  'Activated share disclosure is immutable',
  'an activated disclosure package cannot be expanded'
);
select throws_ok(
  $test$
    update public.record_share_grants
    set scopes = array['program', 'degree-progress', 'full-record']
    where id = '77000000-0000-4000-8000-000000000001'
  $test$,
  '23514',
  'Activated share disclosure is immutable',
  'activated scopes cannot be expanded'
);

set local role service_role;

select is(
  public.verify_record_share(
    digest('lozzi-expired-demo-token', 'sha256'),
    decode(repeat('a2', 32), 'hex')
  ) ->> 'status',
  'expired',
  'expired access fails closed without an onchain write'
);
select is(
  public.verify_record_share(
    digest('lozzi-revoked-demo-token', 'sha256'),
    decode(repeat('a3', 32), 'hex')
  ) ->> 'status',
  'revoked',
  'revoked access fails closed'
);
select is(
  public.verify_record_share(
    digest('lozzi-invalid-demo-token', 'sha256'),
    decode(repeat('a4', 32), 'hex')
  ),
  '{"status":"invalid"}'::jsonb,
  'an invalid token discloses no issuer or academic metadata'
);

reset role;

select results_eq(
  $test$
    select access_result, requested_scopes
    from public.record_share_access_logs
    where request_fingerprint_hash = decode(repeat('a1', 32), 'hex')
  $test$,
  $values$
    values (
      'allowed'::text,
      array['program', 'degree-progress']::text[]
    )
  $values$,
  'access history records the result and authorized scopes'
);
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema in ('public', 'lozzi_private')
      and table_name in (
        'record_share_access_logs',
        'public_verifier_attempts'
      )
      and column_name in ('token', 'bearer_token', 'presented_token')
  ),
  'verifier history has no bearer-token column'
);
select ok(
  not exists (
    select 1
    from public.record_share_access_logs log
    where row_to_json(log)::text like '%lozzi-valid-demo-token%'
  ),
  'access history never contains the bearer token'
);

set local role service_role;

select ok(
  not (
    public.verify_record_share(
      digest('lozzi-valid-demo-token', 'sha256'),
      decode(repeat('a5', 32), 'hex')
    ) ?| array[
      'grantId',
      'studentId',
      'institutionId',
      'saltReference',
      'tokenHash'
    ]
  ),
  'the public package omits internal identifiers, salts, and token hashes'
);

select lives_ok(
  $test$
    do $body$
    begin
      for attempt_number in 1..20 loop
        perform public.verify_record_share(
          digest('synthetic-invalid-rate-limit-token', 'sha256'),
          decode(repeat('a6', 32), 'hex')
        );
      end loop;
    end
    $body$;
  $test$,
  'the bounded verifier attempt budget is available'
);
select throws_ok(
  $test$
    select public.verify_record_share(
      digest('synthetic-invalid-rate-limit-token', 'sha256'),
      decode(repeat('a6', 32), 'hex')
    )
  $test$,
  'P0001',
  'Public verifier rate limit exceeded',
  'the verifier fails closed after the attempt budget'
);

reset role;

select is(
  (
    select count(*)::bigint
    from lozzi_private.public_verifier_attempts
    where request_fingerprint_hash = decode(repeat('a6', 32), 'hex')
  ),
  20::bigint,
  'rate limiting stores only the bounded opaque request fingerprint'
);
select ok(
  not exists (
    select 1
    from public.record_share_access_logs
    where access_result = 'allowed'
      and cardinality(requested_scopes) = 0
  ),
  'allowed access logs always retain the exact authorized scope set'
);

update public.student_programs
set status = 'withdrawn'
where student_id = '13000000-0000-4000-8000-000000000101';

select throws_ok(
  $test$
    select lozzi_private.build_m6_share_disclosure(
      '13000000-0000-4000-8000-000000000101',
      '73000000-0000-4000-8000-000000000001',
      array['program']
    )
  $test$,
  '22023',
  'Selected program disclosure is unavailable',
  'a grant cannot claim a scope whose disclosure source is unavailable'
);

select * from finish();

rollback;
