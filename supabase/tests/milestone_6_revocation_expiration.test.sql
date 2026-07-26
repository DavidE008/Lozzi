begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(25);

select ok(
  has_function_privilege(
    'authenticated',
    'public.revoke_sensitive_share_with_outbox(uuid,uuid,uuid,uuid)',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'public.revoke_sensitive_share_with_outbox(uuid,uuid,uuid,uuid)',
    'execute'
  ),
  'only an authenticated student can enter the revocation transaction'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000102';

select throws_ok(
  $test$
    select public.revoke_sensitive_share_with_outbox(
      '77000000-0000-4000-8000-000000000001',
      '94000000-0000-4000-8000-000000000001',
      '94000000-0000-4000-8000-000000000002',
      '94000000-0000-4000-8000-000000000003'
    )
  $test$,
  '42501',
  'Authorized share grant not found',
  'another student cannot revoke the share'
);

reset role;

update public.record_share_grants
set status = 'active'
where id = '77000000-0000-4000-8000-000000000002';

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000101';

select is(
  public.revoke_sensitive_share_with_outbox(
    '77000000-0000-4000-8000-000000000002',
    '94000000-0000-4000-8000-000000000004',
    '94000000-0000-4000-8000-000000000005',
    '94000000-0000-4000-8000-000000000006'
  ) ->> 'status',
  'expired',
  'expiration is derived without a revocation write'
);

reset role;

select ok(
  exists (
    select 1
    from public.record_share_grants share_grant
    where share_grant.id = '77000000-0000-4000-8000-000000000002'
      and share_grant.status = 'active'
      and share_grant.revoked_at is null
  ),
  'derived expiration remains distinct from explicit revocation'
);
select is(
  (
    select count(*)::bigint
    from public.outbox_events event
    where event.aggregate_id = '77000000-0000-4000-8000-000000000002'
      and event.event_type = 'share_grant.revoke.requested.v1'
  ),
  0::bigint,
  'an expired grant does not require a chain write'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000101';

select is(
  public.revoke_sensitive_share_with_outbox(
    '77000000-0000-4000-8000-000000000001',
    '94000000-0000-4000-8000-000000000007',
    '94000000-0000-4000-8000-000000000008',
    '94000000-0000-4000-8000-000000000009'
  ) ->> 'status',
  'revoked',
  'the owning student revokes offchain access immediately'
);
select is(
  (
    public.revoke_sensitive_share_with_outbox(
      '77000000-0000-4000-8000-000000000001',
      '94000000-0000-4000-8000-000000000010',
      '94000000-0000-4000-8000-000000000011',
      '94000000-0000-4000-8000-000000000012'
    ) ->> 'reconciliationQueued'
  )::boolean,
  false,
  'a legacy local-only grant without commitments needs no chain reconciliation'
);

reset role;

select ok(
  exists (
    select 1
    from public.record_share_grants share_grant
    where share_grant.id = '77000000-0000-4000-8000-000000000001'
      and share_grant.status = 'revoked'
      and share_grant.revoked_at is not null
  ),
  'the canonical offchain grant is durably revoked'
);
select is(
  (
    select count(*)::bigint
    from lozzi_private.resolve_share_scope(
      digest('lozzi-valid-demo-token', 'sha256'),
      'program'
    )
  ),
  0::bigint,
  'revoked scope resolution fails closed immediately'
);

set local role service_role;

select is(
  public.verify_record_share(
    digest('lozzi-valid-demo-token', 'sha256'),
    decode(repeat('c1', 32), 'hex')
  ) ->> 'status',
  'revoked',
  'the public verifier observes immediate offchain revocation'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000101';

select ok(
  (
    public.revoke_sensitive_share_with_outbox(
      '77000000-0000-4000-8000-000000000001',
      '94000000-0000-4000-8000-000000000013',
      '94000000-0000-4000-8000-000000000014',
      '94000000-0000-4000-8000-000000000015'
    ) ->> 'idempotentReplay'
  )::boolean,
  'a replay with a different idempotency key is still idempotent'
);

reset role;

select is(
  (
    select count(*)::bigint
    from public.audit_events audit
    where audit.entity_id = '77000000-0000-4000-8000-000000000001'
      and audit.action = 'share.sensitive.revoke'
  ),
  1::bigint,
  'revocation replay does not duplicate the access-history audit'
);
select is(
  (
    select count(*)::bigint
    from public.outbox_events event
    where event.aggregate_id = '77000000-0000-4000-8000-000000000001'
      and event.event_type = 'share_grant.revoke.requested.v1'
  ),
  0::bigint,
  'a legacy local-only revocation creates no unusable chain event'
);

select lives_ok(
  $test$
    insert into public.record_share_grants (
      id,
      institution_id,
      student_id,
      academic_record_version_id,
      token_hash,
      grant_commitment,
      recipient_label,
      scopes,
      status,
      expires_at,
      created_by,
      chain_status,
      commitment_environment,
      institution_commitment,
      institution_commitment_algorithm,
      institution_commitment_key_version,
      student_commitment,
      student_commitment_algorithm,
      student_commitment_key_version
    )
    values (
      '94000000-0000-4000-8000-000000000101',
      '10000000-0000-4000-8000-000000000001',
      '13000000-0000-4000-8000-000000000101',
      '73000000-0000-4000-8000-000000000001',
      decode(repeat('91', 32), 'hex'),
      decode(repeat('92', 32), 'hex'),
      'Synthetic anchored verifier',
      array['record-summary'],
      'active',
      now() + interval '30 minutes',
      '00000000-0000-4000-8000-000000000101',
      'anchored',
      'test',
      decode(repeat('a1', 32), 'hex'),
      'lozzi-institution-v1',
      1,
      decode(repeat('b1', 32), 'hex'),
      'lozzi-student-v1',
      1
    )
  $test$,
  'the anchored revocation fixture is valid'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000101';

select is(
  public.revoke_sensitive_share_with_outbox(
    '94000000-0000-4000-8000-000000000101',
    '94000000-0000-4000-8000-000000000102',
    '94000000-0000-4000-8000-000000000103',
    '94000000-0000-4000-8000-000000000104'
  ) ->> 'chainStatus',
  'revocation_pending',
  'an anchored grant enters asynchronous chain reconciliation'
);

reset role;

select ok(
  exists (
    select 1
    from public.record_share_grants share_grant
    where share_grant.id = '94000000-0000-4000-8000-000000000101'
      and share_grant.status = 'revoked'
      and share_grant.chain_status = 'revocation_pending'
  ),
  'offchain denial does not wait for chain reconciliation'
);
select is(
  (
    select count(*)::bigint
    from public.outbox_events event
    where event.aggregate_id = '94000000-0000-4000-8000-000000000101'
      and event.event_type = 'share_grant.revoke.requested.v1'
  ),
  1::bigint,
  'anchored revocation queues one reconciliation event'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000101';

select ok(
  (
    public.revoke_sensitive_share_with_outbox(
      '94000000-0000-4000-8000-000000000101',
      '94000000-0000-4000-8000-000000000105',
      '94000000-0000-4000-8000-000000000106',
      '94000000-0000-4000-8000-000000000107'
    ) ->> 'idempotentReplay'
  )::boolean,
  'an anchored revocation replay returns the durable result'
);

reset role;

select is(
  (
    select count(*)::bigint
    from public.outbox_events event
    where event.aggregate_id = '94000000-0000-4000-8000-000000000101'
      and event.event_type = 'share_grant.revoke.requested.v1'
  ),
  1::bigint,
  'anchored replay cannot duplicate the logical revocation event'
);
select is(
  (
    select count(*)::bigint
    from public.audit_events audit
    where audit.entity_id = '94000000-0000-4000-8000-000000000101'
      and audit.action = 'share.sensitive.revoke'
  ),
  1::bigint,
  'anchored replay cannot duplicate its audit event'
);

select lives_ok(
  $test$
    update public.outbox_events
    set
      status = 'dead_letter',
      dead_lettered_at = now(),
      last_error_category = 'reconciliation_failed',
      last_error_code = 'synthetic_reconciliation_failure',
      manual_retry_eligible = true
    where aggregate_id = '94000000-0000-4000-8000-000000000101'
      and event_type = 'share_grant.revoke.requested.v1'
  $test$,
  'the test can model a failed asynchronous chain revocation'
);
select is(
  (
    select status
    from public.record_share_grants
    where id = '94000000-0000-4000-8000-000000000101'
  ),
  'revoked',
  'failed chain reconciliation cannot re-enable offchain access'
);

set local role service_role;

select ok(
  coalesce(
    (
      public.get_m6_outbox_metrics()
        -> 'shareLifecycleCounts'
        ->> 'revoked'
    )::integer,
    0
  ) >= 2,
  'operator metrics expose the derived share lifecycle'
);
select ok(
  coalesce(
    (
      public.get_m6_outbox_metrics()
        -> 'shareReconciliationCounts'
        ->> 'revocation_pending'
    )::integer,
    0
  ) >= 1,
  'operator metrics expose pending chain reconciliation'
);
select ok(
  coalesce(
    (
      public.get_m6_outbox_metrics()
        -> 'shareAccessResultCounts'
        ->> 'denied_revoked'
    )::integer,
    0
  ) >= 1,
  'operator metrics expose access-history outcomes without bearer tokens'
);

reset role;

select * from finish();

rollback;
