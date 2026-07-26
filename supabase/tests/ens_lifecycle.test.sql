begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(18);

select has_table(
  'public',
  'wallet_link_challenges',
  'wallet-link challenges are durable'
);
select has_column(
  'public',
  'ens_identities',
  'request_key',
  'ENS operations persist their onchain idempotency key'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.reserve_ens_issuance(uuid,uuid,uuid,bytea,text,bytea,text,bytea,bytea,bytea,timestamptz)',
    'execute'
  ),
  'authenticated clients cannot reserve ENS issuance directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.reserve_ens_issuance(uuid,uuid,uuid,bytea,text,bytea,text,bytea,bytea,bytea,timestamptz)',
    'execute'
  ),
  'the trusted server can reserve ENS issuance'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.record_ens_identity(uuid,uuid,text,bytea,text,bytea,bytea,bytea,uuid)',
    'execute'
  ),
  'the post-transaction legacy ENS recorder is disabled'
);

set local role service_role;

select is(
  (
    public.create_wallet_link_challenge(
      '91000000-0000-4000-8000-000000000001',
      '13000000-0000-4000-8000-000000000101',
      decode(repeat('71', 20), 'hex'),
      decode(repeat('72', 32), 'hex'),
      decode(repeat('73', 32), 'hex'),
      'lozzi.example',
      'https://lozzi.example/student/settings',
      now(),
      now() + interval '5 minutes'
    )->>'challengeId'
  ),
  '91000000-0000-4000-8000-000000000001',
  'the server persists a bounded wallet-link challenge'
);

select is(
  (
    public.consume_wallet_link_challenge(
      '91000000-0000-4000-8000-000000000001',
      '13000000-0000-4000-8000-000000000101',
      decode(repeat('71', 20), 'hex'),
      decode(repeat('73', 32), 'hex'),
      now()
    )->>'status'
  ),
  'verified',
  'a matching challenge creates a verified Sepolia wallet'
);

select throws_ok(
  $$
    select public.consume_wallet_link_challenge(
      '91000000-0000-4000-8000-000000000001',
      '13000000-0000-4000-8000-000000000101',
      decode(repeat('71', 20), 'hex'),
      decode(repeat('73', 32), 'hex'),
      now()
    )
  $$,
  '22023',
  'Invalid or expired wallet-link challenge',
  'a wallet-link challenge cannot be replayed'
);

select is(
  (
    public.reserve_ens_issuance(
      '13000000-0000-4000-8000-000000000101',
      (
        select id
        from public.student_wallets
        where address = decode(repeat('71', 20), 'hex')
      ),
      '92000000-0000-4000-8000-000000000001',
      decode(repeat('74', 32), 'hex'),
      'calm-river-42.lozzi-sepolia.eth',
      decode(repeat('75', 32), 'hex'),
      'lozzi-sepolia.eth',
      decode(repeat('76', 32), 'hex'),
      decode(repeat('71', 20), 'hex'),
      decode(repeat('77', 20), 'hex'),
      now()
    )->>'status'
  ),
  'pending',
  'ENS issuance begins as a durable reservation'
);

select is(
  (
    public.begin_ens_issuance_submission(
      (
        select id
        from public.ens_identities
        where request_id = '92000000-0000-4000-8000-000000000001'
      ),
      '92000000-0000-4000-8000-000000000001'
    )->>'submissionAuthorized'
  ),
  'true',
  'only the pending-to-submitting transition authorizes a broadcast'
);

select is(
  (
    public.begin_ens_issuance_submission(
      (
        select id
        from public.ens_identities
        where request_id = '92000000-0000-4000-8000-000000000001'
      ),
      '92000000-0000-4000-8000-000000000001'
    )->>'submissionAuthorized'
  ),
  'false',
  'a concurrent retry cannot authorize a duplicate broadcast'
);

select is(
  (
    public.mark_ens_issuance_submitted(
      (
        select id
        from public.ens_identities
        where request_id = '92000000-0000-4000-8000-000000000001'
      ),
      '92000000-0000-4000-8000-000000000001',
      decode(repeat('78', 32), 'hex'),
      now()
    )->>'status'
  ),
  'submitted',
  'the onchain transaction hash is persisted before confirmation'
);

select is(
  (
    public.finalize_ens_issuance(
      (
        select id
        from public.ens_identities
        where request_id = '92000000-0000-4000-8000-000000000001'
      ),
      '92000000-0000-4000-8000-000000000001',
      decode(repeat('78', 32), 'hex'),
      decode(repeat('79', 20), 'hex'),
      decode(repeat('71', 20), 'hex'),
      123456,
      3,
      now()
    )->>'status'
  ),
  'active',
  'independent confirmation activates the ENS identity'
);

select is(
  (
    public.reserve_ens_issuance(
      '13000000-0000-4000-8000-000000000101',
      (
        select id
        from public.student_wallets
        where address = decode(repeat('71', 20), 'hex')
      ),
      '92000000-0000-4000-8000-000000000002',
      decode(repeat('7a', 32), 'hex'),
      'bright-field-18.lozzi-sepolia.eth',
      decode(repeat('7b', 32), 'hex'),
      'lozzi-sepolia.eth',
      decode(repeat('7c', 32), 'hex'),
      decode(repeat('71', 20), 'hex'),
      decode(repeat('77', 20), 'hex'),
      now()
    )->>'requestId'
  ),
  '92000000-0000-4000-8000-000000000001',
  'a new request reuses the existing live identity instead of issuing twice'
);

select is(
  (
    public.revoke_student_wallet(
      '13000000-0000-4000-8000-000000000101',
      (
        select id
        from public.student_wallets
        where address = decode(repeat('71', 20), 'hex')
      )
    )->>'ensClearRequired'
  ),
  'true',
  'wallet revocation queues the public resolver for Safe clearing'
);

select is(
  (
    select status
    from public.ens_identities
    where request_id = '92000000-0000-4000-8000-000000000001'
  ),
  'revocation-pending',
  'the UI cannot represent a revoked wallet alias as active'
);

select is(
  (
    public.finalize_ens_revocation(
      (
        select id
        from public.ens_identities
        where request_id = '92000000-0000-4000-8000-000000000001'
      ),
      null,
      now()
    )->>'status'
  ),
  'revoked',
  'independent zero-resolution evidence finalizes revocation'
);

select is(
  (
    select count(*)::integer
    from public.audit_events
    where action in (
      'wallet.link.verify',
      'ens.issuance.reserve',
      'ens.issuance.submit',
      'ens.issuance.confirm',
      'wallet.link.revoke',
      'ens.revocation.confirm'
    )
  ),
  6,
  'the wallet and ENS lifecycle emits an auditable transition trail'
);

select * from finish();
rollback;
