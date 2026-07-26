begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(67);

select has_column(
  'public',
  'outbox_events',
  'claim_owner',
  'outbox events retain their lease owner'
);
select has_column(
  'public',
  'outbox_events',
  'lease_expires_at',
  'outbox events retain lease expiration'
);
select has_column(
  'public',
  'outbox_events',
  'max_attempts',
  'outbox events enforce an attempt ceiling'
);
select has_column(
  'public',
  'outbox_events',
  'dead_lettered_at',
  'outbox events retain dead-letter time'
);
select has_column(
  'public',
  'outbox_events',
  'manual_retry_eligible',
  'outbox events expose explicit manual retry eligibility'
);
select has_column(
  'public',
  'outbox_events',
  'retry_generation',
  'manual retry has a durable attempt generation'
);
select has_table(
  'lozzi_private',
  'outbox_event_attempts',
  'worker attempts use a private immutable ledger'
);
select has_table(
  'lozzi_private',
  'outbox_event_receipts',
  'provider receipts use a private reconciliation ledger'
);
select ok(
  to_regclass('public.outbox_events_submission_claim_idx') is not null,
  'submission claims have a partial ready-work index'
);
select ok(
  to_regclass('public.outbox_events_reconciliation_claim_idx') is not null,
  'reconciliation claims have a partial ready-work index'
);
select ok(
  to_regclass('public.outbox_events_expired_lease_idx') is not null,
  'expired leases have a partial recovery index'
);
select ok(
  to_regprocedure(
    'public.claim_m6_outbox_events(text,text,integer,integer)'
  ) is not null,
  'the worker claim RPC has a fixed signature'
);
select ok(
  to_regprocedure(
    'public.renew_m6_outbox_lease(uuid,text,integer,integer)'
  ) is not null,
  'the lease renewal RPC has a fixed signature'
);
select ok(
  to_regprocedure(
    'public.complete_m6_outbox_event(uuid,text,integer,text,text,integer,text,text,bigint,bytea,integer,integer)'
  ) is not null,
  'the completion RPC has a fixed receipt shape'
);
select ok(
  to_regprocedure(
    'public.manual_retry_m6_outbox_event(uuid,text)'
  ) is not null,
  'manual retry requires an explicit reason'
);
select ok(
  to_regprocedure('public.get_m6_outbox_metrics()') is not null,
  'worker metrics have a service-only RPC'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.claim_m6_outbox_events(text,text,integer,integer)',
    'execute'
  ),
  'the service worker can claim events'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_m6_outbox_events(text,text,integer,integer)',
    'execute'
  ),
  'authenticated clients cannot claim events'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.complete_m6_outbox_event(uuid,text,integer,text,text,integer,text,text,bigint,bytea,integer,integer)',
    'execute'
  ),
  'the service worker can complete events'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.complete_m6_outbox_event(uuid,text,integer,text,text,integer,text,text,bigint,bytea,integer,integer)',
    'execute'
  ),
  'authenticated clients cannot complete events'
);
select ok(
  not has_table_privilege(
    'service_role',
    'lozzi_private.outbox_event_attempts',
    'select'
  ),
  'the service role cannot read the private attempt ledger directly'
);
select ok(
  not has_table_privilege(
    'service_role',
    'lozzi_private.outbox_event_receipts',
    'select'
  ),
  'the service role cannot read private provider receipts directly'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.outbox_events',
    'select'
  ),
  'authenticated clients cannot inspect operational outbox state'
);
select throws_ok(
  $test$
    select *
    from public.claim_m6_outbox_events(
      'worker.invalid',
      'submission',
      51,
      60
    )
  $test$,
  '22023',
  'Invalid outbox claim request',
  'claim batch size is bounded'
);

create function lozzi_private.insert_m6_worker_test_event(
  p_event_id uuid,
  p_aggregate_id uuid,
  p_available_at timestamptz default now()
)
returns uuid
language plpgsql
set search_path = ''
as $$
begin
  insert into public.outbox_events (
    id,
    institution_id,
    aggregate_type,
    aggregate_id,
    event_type,
    schema_version,
    payload,
    idempotency_key,
    available_at,
    trace_id,
    correlation_id
  )
  values (
    p_event_id,
    '10000000-0000-4000-8000-000000000001',
    'record_share_grant',
    p_aggregate_id,
    'share_grant.revoke.requested.v1',
    1,
    jsonb_build_object(
      'commitmentEnvironment', 'test',
      'grantCommitment', '0x' || repeat('d1', 32),
      'institutionCommitment', '0x' || repeat('a1', 32),
      'institutionCommitmentAlgorithm', 'lozzi-institution-v1',
      'institutionCommitmentKeyVersion', 1,
      'revokedAt', '2026-07-26T01:00:00.000Z',
      'shareGrantId', p_aggregate_id,
      'studentCommitment', '0x' || repeat('b1', 32),
      'studentCommitmentAlgorithm', 'lozzi-student-v1',
      'studentCommitmentKeyVersion', 1
    ),
    p_event_id,
    p_available_at,
    gen_random_uuid(),
    gen_random_uuid()
  );

  return p_event_id;
end;
$$;

select lozzi_private.insert_m6_worker_test_event(
  '93000000-0000-4000-8000-000000000501',
  '93000000-0000-4000-8000-000000000502'
);

select is(
  (
    select count(*)::bigint
    from public.claim_m6_outbox_events(
      'worker.first',
      'submission',
      1,
      60
    )
  ),
  1::bigint,
  'one ready event is leased'
);
select ok(
  exists (
    select 1
    from public.outbox_events event
    where event.id = '93000000-0000-4000-8000-000000000501'
      and event.status = 'processing'
      and event.claim_owner = 'worker.first'
      and event.claim_phase = 'submission'
      and event.attempts = 1
      and event.lease_expires_at > now()
  ),
  'claim ownership, phase, attempt, and expiration are recorded atomically'
);
select is(
  (
    select count(*)::bigint
    from public.claim_m6_outbox_events(
      'worker.duplicate',
      'submission',
      1,
      60
    )
  ),
  0::bigint,
  'a second worker cannot claim an active lease'
);
select ok(
  public.renew_m6_outbox_lease(
    '93000000-0000-4000-8000-000000000501',
    'worker.first',
    1,
    120
  ) > now() + interval '100 seconds',
  'the current owner can renew a live lease'
);
select throws_ok(
  $test$
    select public.renew_m6_outbox_lease(
      '93000000-0000-4000-8000-000000000501',
      'worker.duplicate',
      1,
      60
    )
  $test$,
  '55000',
  'Outbox lease is no longer owned',
  'another worker cannot renew the lease'
);
select throws_ok(
  $test$
    select public.complete_m6_outbox_event(
      '93000000-0000-4000-8000-000000000501',
      'worker.first',
      1,
      'simulation_succeeded',
      null,
      null,
      'transaction_submitted',
      null,
      null,
      null,
      null,
      null
    )
  $test$,
  '22023',
  'Invalid outbox completion',
  'a simulation outcome cannot claim an inconsistent receipt state'
);
select is(
  public.complete_m6_outbox_event(
    '93000000-0000-4000-8000-000000000501',
    'worker.first',
    1,
    'simulation_succeeded',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null
  ) ->> 'status',
  'simulation_succeeded',
  'simulation-only processing is recorded without a transaction'
);
select ok(
  exists (
    select 1
    from public.outbox_events event
    where event.id = '93000000-0000-4000-8000-000000000501'
      and event.status = 'simulation_succeeded'
      and event.manual_retry_eligible
      and event.claim_owner is null
  ),
  'simulation success is terminal until an operator explicitly continues'
);
select ok(
  (
    public.complete_m6_outbox_event(
      '93000000-0000-4000-8000-000000000501',
      'worker.first',
      1,
      'simulation_succeeded',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null
    ) ->> 'idempotentReplay'
  )::boolean,
  'replaying the same completion is idempotent'
);
select throws_ok(
  $test$
    select public.complete_m6_outbox_event(
      '93000000-0000-4000-8000-000000000501',
      'worker.first',
      1,
      'non_retryable',
      'conflicting_completion',
      null,
      null,
      null,
      null,
      null,
      null,
      null
    )
  $test$,
  '55000',
  'Outbox lease is no longer owned',
  'a conflicting completion cannot overwrite terminal state'
);
select ok(
  public.manual_retry_m6_outbox_event(
    '93000000-0000-4000-8000-000000000501',
    'approved_after_simulation'
  ) @> '{"status":"pending","manualRetryCount":1}'::jsonb,
  'manual retry reopens the event with an explicit operator reason'
);
select ok(
  exists (
    select 1
    from public.outbox_events event
    where event.id = '93000000-0000-4000-8000-000000000501'
      and event.status = 'pending'
      and event.retry_generation = 1
      and event.attempts = 0
  ),
  'manual retry starts a fresh attempt generation without erasing history'
);

update public.outbox_events
set max_attempts = 1
where id = '93000000-0000-4000-8000-000000000501';

select is(
  (
    select attempt_number
    from public.claim_m6_outbox_events(
      'worker.retry',
      'submission',
      1,
      60
    )
  ),
  1,
  'a fresh retry generation can reuse bounded attempt number one'
);
select is(
  public.complete_m6_outbox_event(
    '93000000-0000-4000-8000-000000000501',
    'worker.retry',
    1,
    'retryable',
    'provider_unavailable',
    30,
    null,
    null,
    null,
    null,
    null,
    null
  ) ->> 'status',
  'dead_letter',
  'the final retryable attempt transitions to dead letter'
);
select ok(
  exists (
    select 1
    from public.outbox_events event
    where event.id = '93000000-0000-4000-8000-000000000501'
      and event.dead_lettered_at is not null
      and event.manual_retry_eligible
  ),
  'dead-letter work requires an explicit manual retry'
);
select ok(
  public.manual_retry_m6_outbox_event(
    '93000000-0000-4000-8000-000000000501',
    'second_operator_retry'
  ) @> '{"status":"pending","manualRetryCount":2}'::jsonb,
  'dead-letter work can be reopened without deleting prior attempts'
);
select is(
  (
    select count(*)::bigint
    from public.audit_events audit
    where audit.action = 'outbox.manual_retry'
      and audit.entity_id = '93000000-0000-4000-8000-000000000501'
  ),
  2::bigint,
  'every manual retry is audited'
);

update public.outbox_events
set available_at = now() + interval '1 day'
where id = '93000000-0000-4000-8000-000000000501';

select lozzi_private.insert_m6_worker_test_event(
  '93000000-0000-4000-8000-000000000511',
  '93000000-0000-4000-8000-000000000512'
);
select is(
  (
    select count(*)::bigint
    from public.claim_m6_outbox_events(
      'worker.crashed',
      'submission',
      1,
      60
    )
  ),
  1::bigint,
  'a crash-recovery fixture is initially claimed'
);

update public.outbox_events
set lease_expires_at = now() - interval '1 second'
where id = '93000000-0000-4000-8000-000000000511';

select is(
  (
    select count(*)::bigint
    from public.claim_m6_outbox_events(
      'worker.recovery',
      'submission',
      1,
      60
    )
  ),
  1::bigint,
  'an expired lease is reclaimed by another worker'
);
select ok(
  exists (
    select 1
    from lozzi_private.outbox_event_attempts attempt
    where attempt.outbox_event_id =
      '93000000-0000-4000-8000-000000000511'
      and attempt.retry_generation = 0
      and attempt.attempt_number = 1
      and attempt.worker_id = 'worker.crashed'
      and attempt.completed_at is not null
      and attempt.outcome = 'retryable'
      and attempt.error_code = 'stale_lease'
  ),
  'stale-lease recovery closes the crashed attempt without losing history'
);
select throws_ok(
  $test$
    select public.complete_m6_outbox_event(
      '93000000-0000-4000-8000-000000000511',
      'worker.crashed',
      1,
      'completed',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null
    )
  $test$,
  '55000',
  'Outbox lease is no longer owned',
  'the crashed owner cannot complete after lease recovery'
);
select is(
  public.complete_m6_outbox_event(
    '93000000-0000-4000-8000-000000000511',
    'worker.recovery',
    2,
    'non_retryable',
    'invalid_request',
    null,
    null,
    null,
    null,
    null,
    null,
    null
  ) ->> 'status',
  'dead_letter',
  'non-retryable submission failures dead-letter immediately'
);

select lozzi_private.insert_m6_worker_test_event(
  '93000000-0000-4000-8000-000000000521',
  '93000000-0000-4000-8000-000000000522'
);
select is(
  (
    select count(*)::bigint
    from public.claim_m6_outbox_events(
      'worker.submit',
      'submission',
      1,
      60
    )
  ),
  1::bigint,
  'a transaction-ready event can enter the submission phase'
);
select throws_ok(
  $test$
    select public.complete_m6_outbox_event(
      '93000000-0000-4000-8000-000000000521',
      'worker.submit',
      1,
      'completed',
      null,
      null,
      'reconciled',
      null,
      null,
      null,
      null,
      null
    )
  $test$,
  '22023',
  'Invalid outbox completion phase',
  'a submission worker cannot bypass receipt reconciliation'
);
select is(
  public.complete_m6_outbox_event(
    '93000000-0000-4000-8000-000000000521',
    'worker.submit',
    1,
    'transaction_submitted',
    null,
    null,
    'transaction_submitted',
    'managed-relayer:request:521',
    4801,
    decode(repeat('ef', 32), 'hex'),
    0,
    3
  ) ->> 'status',
  'transaction_submitted',
  'a provider operation is durably recorded before reconciliation'
);
select ok(
  exists (
    select 1
    from public.outbox_events event
    join lozzi_private.outbox_event_receipts receipt
      on receipt.outbox_event_id = event.id
    where event.id = '93000000-0000-4000-8000-000000000521'
      and event.status = 'transaction_submitted'
      and receipt.provider_operation_id = 'managed-relayer:request:521'
      and receipt.chain_id = 4801
      and receipt.transaction_hash = decode(repeat('ef', 32), 'hex')
  ),
  'the receipt ledger retains only structured operation and chain evidence'
);
select throws_ok(
  $test$
    select public.complete_m6_outbox_event(
      '93000000-0000-4000-8000-000000000521',
      'worker.submit',
      1,
      'transaction_submitted',
      null,
      null,
      'transaction_submitted',
      'managed-relayer:conflicting-operation',
      4801,
      decode(repeat('ef', 32), 'hex'),
      0,
      3
    )
  $test$,
  '55000',
  'Outbox lease is no longer owned',
  'an idempotent replay rejects conflicting provider receipt evidence'
);
select is(
  (
    select count(*)::bigint
    from public.claim_m6_outbox_events(
      'worker.resubmit',
      'submission',
      1,
      60
    )
  ),
  0::bigint,
  'submitted provider operations cannot be claimed for duplicate submission'
);
select is(
  (
    select attempt_number
    from public.claim_m6_outbox_events(
      'worker.reconcile',
      'reconciliation',
      1,
      60
    )
  ),
  2,
  'submitted work moves to the separate reconciliation claim phase'
);
select throws_ok(
  $test$
    select public.complete_m6_outbox_event(
      '93000000-0000-4000-8000-000000000521',
      'worker.reconcile',
      2,
      'simulation_succeeded',
      null,
      null,
      'simulation_succeeded',
      null,
      null,
      null,
      null,
      null
    )
  $test$,
  '22023',
  'Invalid outbox completion phase',
  'a reconciliation worker cannot reopen transaction simulation'
);
select is(
  public.complete_m6_outbox_event(
    '93000000-0000-4000-8000-000000000521',
    'worker.reconcile',
    2,
    'confirmation_pending',
    null,
    1,
    'confirmation_pending',
    'managed-relayer:request:521',
    4801,
    decode(repeat('ef', 32), 'hex'),
    1,
    3
  ) ->> 'status',
  'confirmation_pending',
  'reconciliation can record bounded confirmation progress'
);

update public.outbox_events
set available_at = now()
where id = '93000000-0000-4000-8000-000000000521';

select is(
  (
    select attempt_number
    from public.claim_m6_outbox_events(
      'worker.reconcile',
      'reconciliation',
      1,
      60
    )
  ),
  3,
  'confirmation-pending work can be reclaimed after its delay'
);
select is(
  public.complete_m6_outbox_event(
    '93000000-0000-4000-8000-000000000521',
    'worker.reconcile',
    3,
    'completed',
    null,
    null,
    'reconciled',
    'managed-relayer:request:521',
    4801,
    decode(repeat('ef', 32), 'hex'),
    3,
    3
  ) ->> 'status',
  'completed',
  'confirmed work becomes completed only after reconciliation'
);
select ok(
  exists (
    select 1
    from lozzi_private.outbox_event_receipts receipt
    where receipt.outbox_event_id =
      '93000000-0000-4000-8000-000000000521'
      and receipt.state = 'reconciled'
      and receipt.confirmation_count = 3
      and receipt.confirmed_at is not null
      and receipt.reconciled_at is not null
  ),
  'the reconciled receipt retains confirmation and reconciliation evidence'
);
select ok(
  (
    public.complete_m6_outbox_event(
      '93000000-0000-4000-8000-000000000521',
      'worker.reconcile',
      3,
      'completed',
      null,
      null,
      'reconciled',
      'managed-relayer:request:521',
      4801,
      decode(repeat('ef', 32), 'hex'),
      3,
      3
    ) ->> 'idempotentReplay'
  )::boolean,
  'reconciled completion is idempotent'
);

select lozzi_private.insert_m6_worker_test_event(
  '93000000-0000-4000-8000-000000000531',
  '93000000-0000-4000-8000-000000000532'
);
select is(
  (
    select count(*)::bigint
    from public.claim_m6_outbox_events(
      'worker.unconfigured',
      'submission',
      1,
      60
    )
  ),
  1::bigint,
  'configuration-blocked work is first claimed normally'
);
select is(
  public.complete_m6_outbox_event(
    '93000000-0000-4000-8000-000000000531',
    'worker.unconfigured',
    1,
    'configuration_blocked',
    'registry_not_configured',
    null,
    null,
    null,
    null,
    null,
    null,
    null
  ) ->> 'status',
  'configuration_blocked',
  'missing transaction configuration fails closed'
);
select ok(
  exists (
    select 1
    from public.outbox_events event
    where event.id = '93000000-0000-4000-8000-000000000531'
      and event.status = 'configuration_blocked'
      and event.manual_retry_eligible
      and event.last_error_code = 'registry_not_configured'
  ),
  'configuration-blocked state is operator-visible and requires approval'
);
select ok(
  (
    public.get_m6_outbox_metrics() -> 'statusCounts'
  ) ? 'configuration_blocked',
  'metrics expose structured event status counts'
);
select is(
  (
    public.get_m6_outbox_metrics()
      -> 'receiptStateCounts'
      ->> 'reconciled'
  )::integer,
  1,
  'metrics expose structured receipt state counts'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.get_m6_outbox_metrics()',
    'execute'
  ),
  'the service worker can read bounded operational metrics'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_m6_outbox_metrics()',
    'execute'
  ),
  'authenticated clients cannot read worker metrics'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.manual_retry_m6_outbox_event(uuid,text)',
    'execute'
  ),
  'authenticated clients cannot reopen terminal worker events'
);

select * from finish();

rollback;
