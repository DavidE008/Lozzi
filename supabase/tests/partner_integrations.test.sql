begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(34);

insert into public.student_wallets (
  id,
  institution_id,
  student_id,
  chain_id,
  address,
  status,
  verified_at
)
values (
  '81000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '13000000-0000-4000-8000-000000000101',
  11155111,
  decode(repeat('11', 20), 'hex'),
  'verified',
  now()
);

select has_view(
  'public',
  'student_partner_summary',
  'student partner summary view exists'
);

select ok(
  'security_invoker=true' = any (
    select unnest(reloptions)
    from pg_class
    where oid = 'public.student_partner_summary'::regclass
  ),
  'student partner summary uses security invoker'
);

select has_column(
  'public',
  'world_verifications',
  'nullifier',
  'World nullifiers are persisted as numeric values'
);

select has_column(
  'public',
  'zero_g_objects',
  'ciphertext_commitment',
  '0G objects store a ciphertext commitment'
);

select has_column(
  'public',
  'ai_inference_runs',
  'output_zero_g_object_id',
  'AI runs link to encrypted output objects'
);

select hasnt_column(
  'public',
  'world_verifications',
  'proof',
  'World proofs are not persisted'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.record_world_verification(uuid,text,numeric,bytea,text,timestamptz,text,uuid)',
    'execute'
  ),
  'anonymous users cannot record World verifications'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.record_world_verification(uuid,text,numeric,bytea,text,timestamptz,text,uuid)',
    'execute'
  ),
  'authenticated clients cannot record untrusted World results'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.record_world_verification(uuid,text,numeric,bytea,text,timestamptz,text,uuid)',
    'execute'
  ),
  'only the trusted server role can record World results'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.world_verifications',
    'insert'
  ),
  'authenticated clients cannot insert World rows directly'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.zero_g_objects',
    'insert'
  ),
  'authenticated clients cannot insert 0G rows directly'
);

set local role service_role;

select is(
  (
    public.record_world_verification(
      '13000000-0000-4000-8000-000000000101',
      'lozzi-student-verification',
      42,
      decode(repeat('22', 32), 'hex'),
      'orb',
      now(),
      'world-response-synthetic',
      '82000000-0000-4000-8000-000000000001'
    )->>'status'
  ),
  'verified',
  'trusted server records a verified World response'
);

select is(
  (
    public.record_world_verification(
      '13000000-0000-4000-8000-000000000101',
      'lozzi-student-verification',
      42,
      decode(repeat('22', 32), 'hex'),
      'orb',
      now(),
      'world-response-synthetic',
      '82000000-0000-4000-8000-000000000001'
    )->>'idempotentReplay'
  ),
  'true',
  'World recording replays the same idempotency result'
);

select throws_ok(
  $$
    select public.record_world_verification(
      '13000000-0000-4000-8000-000000000101',
      'lozzi-student-verification',
      42,
      decode(repeat('22', 32), 'hex'),
      'orb',
      now(),
      'world-response-replay',
      '82000000-0000-4000-8000-000000000002'
    )
  $$,
  '23505',
  'World nullifier replay detected',
  'a World nullifier cannot be replayed with a new idempotency key'
);

select is(
  (
    select nullifier::text
    from public.world_verifications
    where student_id = '13000000-0000-4000-8000-000000000101'
  ),
  '42',
  'World nullifier remains an exact numeric value'
);

select is(
  (
    public.record_ens_identity(
      '13000000-0000-4000-8000-000000000101',
      '81000000-0000-4000-8000-000000000001',
      'aisha.lozzi-sepolia.eth',
      decode(repeat('33', 32), 'hex'),
      'lozzi-sepolia.eth',
      decode(repeat('11', 20), 'hex'),
      decode(repeat('44', 20), 'hex'),
      decode(repeat('55', 32), 'hex'),
      '82000000-0000-4000-8000-000000000003'
    )->>'status'
  ),
  'active',
  'trusted server records a resolved ENS subname'
);

select is(
  (
    select public_name
    from public.ens_identities
    where student_id = '13000000-0000-4000-8000-000000000101'
  ),
  'aisha.lozzi-sepolia.eth',
  'ENS identity stores only the selected public pseudonym'
);

select is(
  (
    public.record_zero_g_object(
      '13000000-0000-4000-8000-000000000101',
      'degree-audit-context',
      decode(repeat('66', 32), 'hex'),
      decode(repeat('67', 32), 'hex'),
      decode(repeat('68', 32), 'hex'),
      decode(repeat('69', 12), 'hex'),
      'kms://lozzi/synthetic/input-key',
      '0g://synthetic/input',
      decode(repeat('6a', 32), 'hex'),
      2048,
      '82000000-0000-4000-8000-000000000004'
    )->>'status'
  ),
  'available',
  'trusted server records encrypted 0G input metadata'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'zero_g_objects'
      and column_name in (
        'plaintext',
        'encryption_key',
        'wrapped_key',
        'academic_payload'
      )
  ),
  '0G metadata table has no plaintext or encryption-key column'
);

create temporary table partner_test_context as
select (
  public.start_ai_progress_run(
    '13000000-0000-4000-8000-000000000101',
    'zero-g-router',
    'synthetic-model',
    'tee',
    decode(repeat('70', 32), 'hex'),
    (
      select id
      from public.zero_g_objects
      where root_hash = decode(repeat('66', 32), 'hex')
    ),
    '82000000-0000-4000-8000-000000000005'
  )->>'runId'
)::uuid as run_id;

select is(
  (
    select schema_validation_status
    from public.ai_inference_runs
    where id = (select run_id from partner_test_context)
  ),
  'pending',
  '0G Compute run starts with pending schema validation'
);

select throws_ok(
  $$
    select public.complete_ai_progress_run(
      (select run_id from partner_test_context),
      decode(repeat('71', 32), 'hex'),
      null,
      'valid',
      'router-request-synthetic',
      null
    )
  $$,
  '22023',
  'Invalid 0G Compute completion result',
  'a valid AI result requires encrypted output storage'
);

select is(
  (
    public.record_zero_g_object(
      '13000000-0000-4000-8000-000000000101',
      'degree-audit-context',
      decode(repeat('72', 32), 'hex'),
      decode(repeat('73', 32), 'hex'),
      decode(repeat('74', 32), 'hex'),
      decode(repeat('75', 12), 'hex'),
      'kms://lozzi/synthetic/output-key',
      '0g://synthetic/output',
      decode(repeat('76', 32), 'hex'),
      1024,
      '82000000-0000-4000-8000-000000000006'
    )->>'status'
  ),
  'available',
  'trusted server records encrypted 0G output metadata'
);

select is(
  (
    public.complete_ai_progress_run(
      (select run_id from partner_test_context),
      decode(repeat('71', 32), 'hex'),
      (
        select id
        from public.zero_g_objects
        where root_hash = decode(repeat('72', 32), 'hex')
      ),
      'valid',
      'router-request-synthetic',
      null
    )->>'status'
  ),
  'valid',
  'schema-valid AI output completes after encrypted persistence'
);

select is(
  (
    public.complete_ai_progress_run(
      (select run_id from partner_test_context),
      decode(repeat('71', 32), 'hex'),
      (
        select id
        from public.zero_g_objects
        where root_hash = decode(repeat('72', 32), 'hex')
      ),
      'valid',
      'router-request-synthetic',
      null
    )->>'idempotentReplay'
  ),
  'true',
  'AI completion replays only an identical result'
);

select lives_ok(
  $$
    select public.set_integration_capability(
      '10000000-0000-4000-8000-000000000001',
      'zero-g',
      'failed',
      '0G Router health check failed.',
      null,
      'provider-unavailable'
    )
  $$,
  'trusted server records a categorized provider failure'
);

select is(
  (
    select state || ':' || error_category
    from public.integration_capabilities
    where institution_id = '10000000-0000-4000-8000-000000000001'
      and provider = 'zero-g'
  ),
  'failed:provider-unavailable',
  'provider failure state remains explicit'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000101';

select is(
  (select count(*)::bigint from public.student_partner_summary),
  1::bigint,
  'student sees only their own partner summary'
);

select is(
  (
    select world_status || ':' || ens_status || ':' || ai_validation_status
    from public.student_partner_summary
  ),
  'verified:active:valid',
  'student sees verified, resolved, and validated partner states'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000102';

select is(
  (select count(*)::bigint from public.world_verifications),
  0::bigint,
  'another student cannot read World verification metadata'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000204';

select is(
  (
    select count(*)::bigint
    from public.ai_inference_runs
    where student_id = '13000000-0000-4000-8000-000000000101'
  ),
  1::bigint,
  'assigned advisor can read the scoped AI run'
);

select is(
  (
    select count(*)::bigint
    from public.world_verifications
    where student_id = '13000000-0000-4000-8000-000000000101'
  ),
  0::bigint,
  'assigned advisor cannot read World identity metadata'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000202';

select is(
  (
    select count(*)::bigint
    from public.ai_inference_runs
    where student_id = '13000000-0000-4000-8000-000000000101'
  ),
  0::bigint,
  'assigned instructor cannot read AI integration metadata'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000201';

select is(
  (
    select count(*)::bigint
    from public.student_partner_summary
    where student_id = '13000000-0000-4000-8000-000000000101'
  ),
  1::bigint,
  'institution registrar can read the scoped partner summary'
);

reset role;

select ok(
  not exists (
    select 1
    from public.audit_events
    where action in (
      'world.verification.record',
      'ens.identity.record',
      'zero-g.object.record',
      'zero-g.progress.complete'
    )
      and metadata ?| array[
        'email',
        'name',
        'student_number',
        'grade',
        'gpa',
        'nullifier',
        'signal',
        'proof',
        'plaintext',
        'encryption_key'
      ]
  ),
  'partner audit metadata remains PII-free and proof-free'
);

select * from finish();
rollback;
