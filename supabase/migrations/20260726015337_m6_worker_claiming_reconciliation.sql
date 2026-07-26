alter table public.outbox_events
  drop constraint outbox_events_status_check;

alter table public.outbox_events
  add column claim_owner text,
  add column claim_phase text,
  add column lease_expires_at timestamptz,
  add column first_attempt_at timestamptz,
  add column last_attempt_at timestamptz,
  add column max_attempts integer not null default 8,
  add column dead_lettered_at timestamptz,
  add column manual_retry_eligible boolean not null default false,
  add column manual_retry_count integer not null default 0,
  add column retry_generation integer not null default 0,
  add column last_error_code text,
  add constraint outbox_events_status_check check (
    status in (
      'pending',
      'processing',
      'retry_scheduled',
      'completed',
      'failed',
      'dead_letter',
      'configuration_blocked',
      'simulation_succeeded',
      'simulation_rejected',
      'transaction_submitted',
      'confirmation_pending',
      'reconciliation_failed'
    )
  ),
  add constraint outbox_events_claim_owner_check check (
    claim_owner is null
    or claim_owner ~ '^[A-Za-z0-9._:-]{3,120}$'
  ),
  add constraint outbox_events_claim_phase_check check (
    claim_phase is null
    or claim_phase in ('submission', 'reconciliation')
  ),
  add constraint outbox_events_attempt_ceiling_check check (
    attempts >= 0
    and max_attempts between 1 and 32
    and manual_retry_count >= 0
    and retry_generation >= 0
  ),
  add constraint outbox_events_error_classification_check check (
    last_error_category is null
    or last_error_category in (
      'retryable',
      'non_retryable',
      'configuration_blocked',
      'simulation_rejected',
      'reconciliation_failed'
    )
  ),
  add constraint outbox_events_error_code_check check (
    last_error_code is null
    or (
      char_length(last_error_code) between 1 and 120
      and last_error_code ~ '^[a-z0-9][a-z0-9._:-]*$'
    )
  ),
  add constraint outbox_events_lease_state_check check (
    (
      status = 'processing'
      and claim_owner is not null
      and claim_phase is not null
      and lease_expires_at is not null
    )
    or (
      status <> 'processing'
      and claim_owner is null
      and claim_phase is null
      and lease_expires_at is null
    )
  ),
  add constraint outbox_events_terminal_timestamp_check check (
    (status <> 'completed' or completed_at is not null)
    and (status <> 'dead_letter' or dead_lettered_at is not null)
  );

drop index public.outbox_events_pending_idx;

create index outbox_events_submission_claim_idx
  on public.outbox_events (available_at, created_at)
  where status in ('pending', 'retry_scheduled');

create index outbox_events_reconciliation_claim_idx
  on public.outbox_events (available_at, created_at)
  where status in (
    'transaction_submitted',
    'confirmation_pending',
    'reconciliation_failed'
  );

create index outbox_events_expired_lease_idx
  on public.outbox_events (lease_expires_at)
  where status = 'processing';

create table lozzi_private.outbox_event_attempts (
  id bigint generated always as identity primary key,
  outbox_event_id uuid not null
    references public.outbox_events(id) on delete restrict,
  retry_generation integer not null check (retry_generation >= 0),
  attempt_number integer not null check (attempt_number > 0),
  phase text not null check (phase in ('submission', 'reconciliation')),
  worker_id text not null check (
    worker_id ~ '^[A-Za-z0-9._:-]{3,120}$'
  ),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  outcome text check (
    outcome is null
    or outcome in (
      'completed',
      'retryable',
      'non_retryable',
      'configuration_blocked',
      'simulation_succeeded',
      'simulation_rejected',
      'transaction_submitted',
      'confirmation_pending',
      'reconciliation_failed'
    )
  ),
  error_code text check (
    error_code is null
    or (
      char_length(error_code) between 1 and 120
      and error_code ~ '^[a-z0-9][a-z0-9._:-]*$'
    )
  ),
  retry_after_seconds integer check (
    retry_after_seconds is null
    or retry_after_seconds between 1 and 3600
  ),
  unique (outbox_event_id, retry_generation, attempt_number)
);

create index outbox_event_attempts_incomplete_idx
  on lozzi_private.outbox_event_attempts (
    outbox_event_id,
    retry_generation,
    attempt_number
  )
  where completed_at is null;

create table lozzi_private.outbox_event_receipts (
  outbox_event_id uuid primary key
    references public.outbox_events(id) on delete restrict,
  processing_mode text not null check (
    processing_mode in ('simulation_only', 'transaction')
  ),
  state text not null check (
    state in (
      'not_started',
      'simulation_succeeded',
      'simulation_rejected',
      'transaction_submitted',
      'confirmation_pending',
      'confirmed',
      'reconciled',
      'reconciliation_failed'
    )
  ),
  provider_operation_id text check (
    provider_operation_id is null
    or (
      char_length(provider_operation_id) between 1 and 200
      and provider_operation_id ~ '^[A-Za-z0-9._:-]+$'
    )
  ),
  chain_id bigint check (chain_id is null or chain_id > 0),
  transaction_hash bytea check (
    transaction_hash is null
    or octet_length(transaction_hash) = 32
  ),
  confirmation_count integer not null default 0 check (
    confirmation_count >= 0
  ),
  expected_confirmations integer check (
    expected_confirmations is null
    or expected_confirmations between 1 and 256
  ),
  submitted_at timestamptz,
  confirmed_at timestamptz,
  reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    state not in ('transaction_submitted', 'confirmation_pending', 'confirmed', 'reconciled')
    or provider_operation_id is not null
  ),
  check (
    state not in ('confirmed', 'reconciled')
    or confirmed_at is not null
  ),
  check (state <> 'reconciled' or reconciled_at is not null)
);

revoke all on table lozzi_private.outbox_event_attempts
  from public, anon, authenticated, service_role;
revoke all on table lozzi_private.outbox_event_receipts
  from public, anon, authenticated, service_role;

create function public.claim_m6_outbox_events(
  p_worker_id text,
  p_phase text,
  p_batch_size integer,
  p_lease_seconds integer
)
returns table (
  event_id uuid,
  institution_id uuid,
  aggregate_type text,
  aggregate_id uuid,
  event_type text,
  schema_version integer,
  payload jsonb,
  idempotency_key uuid,
  attempt_number integer,
  available_at timestamptz,
  created_at timestamptz,
  trace_id uuid,
  correlation_id uuid,
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  lease_expires_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_worker_id is null
    or p_worker_id !~ '^[A-Za-z0-9._:-]{3,120}$'
    or p_phase not in ('submission', 'reconciliation')
    or p_batch_size not between 1 and 50
    or p_lease_seconds not between 5 and 300
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid outbox claim request';
  end if;

  update lozzi_private.outbox_event_attempts attempt
  set
    completed_at = now(),
    outcome = 'retryable',
    error_code = 'stale_lease'
  from public.outbox_events event
  where event.status = 'processing'
    and event.claim_phase = p_phase
    and event.lease_expires_at <= now()
    and attempt.outbox_event_id = event.id
    and attempt.retry_generation = event.retry_generation
    and attempt.attempt_number = event.attempts
    and attempt.completed_at is null;

  if p_phase = 'submission' then
    update public.outbox_events event
    set
      status = 'dead_letter',
      dead_lettered_at = now(),
      manual_retry_eligible = true,
      last_error_category = 'non_retryable',
      last_error_code = 'attempt_ceiling_exhausted',
      updated_at = now()
    where event.status in ('pending', 'retry_scheduled')
      and event.attempts >= event.max_attempts;
  else
    update public.outbox_events event
    set
      manual_retry_eligible = true,
      last_error_category = 'reconciliation_failed',
      last_error_code = 'attempt_ceiling_exhausted',
      updated_at = now()
    where event.status = 'reconciliation_failed'
      and event.attempts >= event.max_attempts;
  end if;

  return query
  with candidates as (
    select event.id
    from public.outbox_events event
    where event.attempts < event.max_attempts
      and not event.manual_retry_eligible
      and (
        (
          p_phase = 'submission'
          and (
            (
              event.status in ('pending', 'retry_scheduled')
              and event.available_at <= now()
            )
            or (
              event.status = 'processing'
              and event.claim_phase = 'submission'
              and event.lease_expires_at <= now()
            )
          )
        )
        or (
          p_phase = 'reconciliation'
          and (
            (
              event.status in (
                'transaction_submitted',
                'confirmation_pending',
                'reconciliation_failed'
              )
              and event.available_at <= now()
            )
            or (
              event.status = 'processing'
              and event.claim_phase = 'reconciliation'
              and event.lease_expires_at <= now()
            )
          )
        )
      )
    order by event.available_at, event.created_at, event.id
    for update skip locked
    limit p_batch_size
  ),
  claimed as (
    update public.outbox_events event
    set
      status = 'processing',
      claim_owner = p_worker_id,
      claim_phase = p_phase,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      locked_at = now(),
      attempts = event.attempts + 1,
      first_attempt_at = coalesce(event.first_attempt_at, now()),
      last_attempt_at = now(),
      updated_at = now()
    from candidates
    where event.id = candidates.id
    returning event.*
  ),
  recorded_attempts as (
    insert into lozzi_private.outbox_event_attempts (
      outbox_event_id,
      retry_generation,
      attempt_number,
      phase,
      worker_id,
      started_at
    )
    select
      claimed.id,
      claimed.retry_generation,
      claimed.attempts,
      p_phase,
      p_worker_id,
      claimed.last_attempt_at
    from claimed
    returning outbox_event_id
  )
  select
    claimed.id,
    claimed.institution_id,
    claimed.aggregate_type,
    claimed.aggregate_id,
    claimed.event_type,
    claimed.schema_version,
    claimed.payload,
    claimed.idempotency_key,
    claimed.attempts,
    claimed.available_at,
    claimed.created_at,
    claimed.trace_id,
    claimed.correlation_id,
    claimed.first_attempt_at,
    claimed.last_attempt_at,
    claimed.lease_expires_at
  from claimed
  join recorded_attempts on recorded_attempts.outbox_event_id = claimed.id
  order by claimed.available_at, claimed.created_at, claimed.id;
end;
$$;

create function public.renew_m6_outbox_lease(
  p_event_id uuid,
  p_worker_id text,
  p_attempt_number integer,
  p_lease_seconds integer
)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  renewed_until timestamptz;
begin
  if p_worker_id is null
    or p_worker_id !~ '^[A-Za-z0-9._:-]{3,120}$'
    or p_attempt_number <= 0
    or p_lease_seconds not between 5 and 300
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid outbox lease renewal';
  end if;

  update public.outbox_events event
  set
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    updated_at = now()
  where event.id = p_event_id
    and event.status = 'processing'
    and event.claim_owner = p_worker_id
    and event.attempts = p_attempt_number
    and event.lease_expires_at > now()
  returning event.lease_expires_at into renewed_until;

  if renewed_until is null then
    raise exception using
      errcode = '55000',
      message = 'Outbox lease is no longer owned';
  end if;

  return renewed_until;
end;
$$;

create function public.complete_m6_outbox_event(
  p_event_id uuid,
  p_worker_id text,
  p_attempt_number integer,
  p_outcome text,
  p_error_code text,
  p_retry_after_seconds integer,
  p_receipt_state text,
  p_provider_operation_id text,
  p_chain_id bigint,
  p_transaction_hash bytea,
  p_confirmation_count integer,
  p_expected_confirmations integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_event public.outbox_events%rowtype;
  next_status text;
  next_available_at timestamptz;
  next_error_category text;
  next_error_code text;
  next_manual_retry boolean := false;
  next_dead_lettered_at timestamptz;
  next_completed_at timestamptz;
  receipt_mode text;
  normalized_receipt_state text;
begin
  if p_worker_id is null
    or p_worker_id !~ '^[A-Za-z0-9._:-]{3,120}$'
    or p_attempt_number <= 0
    or p_outcome not in (
      'completed',
      'retryable',
      'non_retryable',
      'configuration_blocked',
      'simulation_succeeded',
      'simulation_rejected',
      'transaction_submitted',
      'confirmation_pending',
      'reconciliation_failed'
    )
    or (
      p_error_code is not null
      and (
        char_length(p_error_code) not between 1 and 120
        or p_error_code !~ '^[a-z0-9][a-z0-9._:-]*$'
      )
    )
    or (
      p_retry_after_seconds is not null
      and p_retry_after_seconds not between 1 and 3600
    )
    or (
      p_receipt_state is not null
      and p_receipt_state not in (
        'simulation_succeeded',
        'simulation_rejected',
        'transaction_submitted',
        'confirmation_pending',
        'confirmed',
        'reconciled',
        'reconciliation_failed'
      )
    )
    or (
      p_receipt_state is not null
      and p_receipt_state is distinct from case p_outcome
        when 'simulation_succeeded' then 'simulation_succeeded'
        when 'simulation_rejected' then 'simulation_rejected'
        when 'transaction_submitted' then 'transaction_submitted'
        when 'confirmation_pending' then 'confirmation_pending'
        when 'reconciliation_failed' then 'reconciliation_failed'
        when 'completed' then 'reconciled'
        else null
      end
    )
    or (
      p_provider_operation_id is not null
      and (
        char_length(p_provider_operation_id) not between 1 and 200
        or p_provider_operation_id !~ '^[A-Za-z0-9._:-]+$'
      )
    )
    or (p_chain_id is not null and p_chain_id <= 0)
    or (
      p_transaction_hash is not null
      and octet_length(p_transaction_hash) <> 32
    )
    or (p_confirmation_count is not null and p_confirmation_count < 0)
    or (
      p_expected_confirmations is not null
      and p_expected_confirmations not between 1 and 256
    )
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid outbox completion';
  end if;

  select event.*
  into target_event
  from public.outbox_events event
  where event.id = p_event_id
    and event.status = 'processing'
    and event.claim_owner = p_worker_id
    and event.attempts = p_attempt_number
    and event.lease_expires_at > now()
  for update;

  if target_event.id is null then
    select event.*
    into target_event
    from public.outbox_events event
    join lozzi_private.outbox_event_attempts attempt
      on attempt.outbox_event_id = event.id
      and attempt.retry_generation = event.retry_generation
      and attempt.attempt_number = p_attempt_number
    where event.id = p_event_id
      and event.claim_owner is null
      and attempt.worker_id = p_worker_id
      and attempt.completed_at is not null
      and attempt.outcome = p_outcome
      and (
        p_provider_operation_id is null
        or exists (
          select 1
          from lozzi_private.outbox_event_receipts receipt
          where receipt.outbox_event_id = event.id
            and receipt.provider_operation_id = p_provider_operation_id
        )
      )
      and (
        p_chain_id is null
        or exists (
          select 1
          from lozzi_private.outbox_event_receipts receipt
          where receipt.outbox_event_id = event.id
            and receipt.chain_id = p_chain_id
        )
      )
      and (
        p_transaction_hash is null
        or exists (
          select 1
          from lozzi_private.outbox_event_receipts receipt
          where receipt.outbox_event_id = event.id
            and receipt.transaction_hash = p_transaction_hash
        )
      );

    if target_event.id is not null then
      return jsonb_build_object(
        'eventId', target_event.id,
        'status', target_event.status,
        'attemptNumber', target_event.attempts,
        'manualRetryEligible', target_event.manual_retry_eligible,
        'availableAt', target_event.available_at,
        'idempotentReplay', true
      );
    end if;

    raise exception using
      errcode = '55000',
      message = 'Outbox lease is no longer owned';
  end if;

  if (
    target_event.claim_phase = 'submission'
    and p_outcome in (
      'completed',
      'confirmation_pending',
      'reconciliation_failed'
    )
  )
    or (
      target_event.claim_phase = 'reconciliation'
      and p_outcome in (
        'simulation_succeeded',
        'simulation_rejected',
        'transaction_submitted'
      )
    )
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid outbox completion phase';
  end if;

  if p_outcome in ('transaction_submitted', 'confirmation_pending', 'completed')
    and target_event.claim_phase = 'reconciliation'
    and not exists (
      select 1
      from lozzi_private.outbox_event_receipts receipt
      where receipt.outbox_event_id = target_event.id
    )
  then
    raise exception using
      errcode = '55000',
      message = 'Reconciliation receipt is missing';
  end if;

  if p_outcome = 'transaction_submitted'
    and p_provider_operation_id is null
  then
    raise exception using
      errcode = '22023',
      message = 'Submitted transaction requires a provider operation ID';
  end if;

  next_status := case p_outcome
    when 'completed' then 'completed'
    when 'simulation_succeeded' then 'simulation_succeeded'
    when 'simulation_rejected' then 'simulation_rejected'
    when 'configuration_blocked' then 'configuration_blocked'
    when 'transaction_submitted' then 'transaction_submitted'
    when 'confirmation_pending' then 'confirmation_pending'
    when 'reconciliation_failed' then 'reconciliation_failed'
    when 'non_retryable' then
      case
        when target_event.claim_phase = 'submission' then 'dead_letter'
        else 'reconciliation_failed'
      end
    when 'retryable' then
      case
        when target_event.attempts >= target_event.max_attempts
          and target_event.claim_phase = 'submission'
          then 'dead_letter'
        when target_event.claim_phase = 'submission' then 'retry_scheduled'
        else 'reconciliation_failed'
      end
  end;

  next_available_at := case
    when p_outcome in ('retryable', 'reconciliation_failed', 'confirmation_pending')
      then now() + make_interval(secs => coalesce(p_retry_after_seconds, 30))
    else target_event.available_at
  end;
  next_manual_retry := case
    when p_outcome in (
      'configuration_blocked',
      'simulation_succeeded',
      'simulation_rejected',
      'non_retryable'
    ) then true
    when p_outcome in ('retryable', 'reconciliation_failed')
      and target_event.attempts >= target_event.max_attempts
      then true
    else false
  end;
  next_error_category := case
    when p_outcome in (
      'retryable',
      'non_retryable',
      'configuration_blocked',
      'simulation_rejected',
      'reconciliation_failed'
    ) then p_outcome
    else null
  end;
  next_error_code := case
    when next_error_category is not null
      then coalesce(p_error_code, p_outcome)
    else null
  end;
  next_dead_lettered_at := case
    when next_status = 'dead_letter' then now()
    else null
  end;
  next_completed_at := case
    when next_status = 'completed' then now()
    else null
  end;

  update lozzi_private.outbox_event_attempts attempt
  set
    completed_at = now(),
    outcome = p_outcome,
    error_code = next_error_code,
    retry_after_seconds = case
      when p_outcome in (
        'retryable',
        'reconciliation_failed',
        'confirmation_pending'
      )
        then coalesce(p_retry_after_seconds, 30)
      else null
    end
  where attempt.outbox_event_id = target_event.id
    and attempt.retry_generation = target_event.retry_generation
    and attempt.attempt_number = target_event.attempts
    and attempt.worker_id = p_worker_id
    and attempt.completed_at is null;

  if not found then
    raise exception using
      errcode = '55000',
      message = 'Outbox attempt is no longer active';
  end if;

  normalized_receipt_state := coalesce(
    p_receipt_state,
    case p_outcome
      when 'simulation_succeeded' then 'simulation_succeeded'
      when 'simulation_rejected' then 'simulation_rejected'
      when 'transaction_submitted' then 'transaction_submitted'
      when 'confirmation_pending' then 'confirmation_pending'
      when 'reconciliation_failed' then 'reconciliation_failed'
      when 'completed' then 'reconciled'
      else null
    end
  );

  if normalized_receipt_state is not null then
    receipt_mode := case
      when normalized_receipt_state in (
        'simulation_succeeded',
        'simulation_rejected'
      ) then 'simulation_only'
      else 'transaction'
    end;

    insert into lozzi_private.outbox_event_receipts (
      outbox_event_id,
      processing_mode,
      state,
      provider_operation_id,
      chain_id,
      transaction_hash,
      confirmation_count,
      expected_confirmations,
      submitted_at,
      confirmed_at,
      reconciled_at
    )
    values (
      target_event.id,
      receipt_mode,
      normalized_receipt_state,
      p_provider_operation_id,
      p_chain_id,
      p_transaction_hash,
      coalesce(p_confirmation_count, 0),
      p_expected_confirmations,
      case
        when normalized_receipt_state in (
          'transaction_submitted',
          'confirmation_pending',
          'confirmed',
          'reconciled'
        ) then now()
      end,
      case
        when normalized_receipt_state in ('confirmed', 'reconciled') then now()
      end,
      case when normalized_receipt_state = 'reconciled' then now() end
    )
    on conflict (outbox_event_id) do update
    set
      processing_mode = excluded.processing_mode,
      state = excluded.state,
      provider_operation_id = coalesce(
        excluded.provider_operation_id,
        lozzi_private.outbox_event_receipts.provider_operation_id
      ),
      chain_id = coalesce(
        excluded.chain_id,
        lozzi_private.outbox_event_receipts.chain_id
      ),
      transaction_hash = coalesce(
        excluded.transaction_hash,
        lozzi_private.outbox_event_receipts.transaction_hash
      ),
      confirmation_count = greatest(
        lozzi_private.outbox_event_receipts.confirmation_count,
        excluded.confirmation_count
      ),
      expected_confirmations = coalesce(
        excluded.expected_confirmations,
        lozzi_private.outbox_event_receipts.expected_confirmations
      ),
      submitted_at = coalesce(
        lozzi_private.outbox_event_receipts.submitted_at,
        excluded.submitted_at
      ),
      confirmed_at = coalesce(
        lozzi_private.outbox_event_receipts.confirmed_at,
        excluded.confirmed_at
      ),
      reconciled_at = coalesce(
        lozzi_private.outbox_event_receipts.reconciled_at,
        excluded.reconciled_at
      ),
      updated_at = now();
  end if;

  update public.outbox_events event
  set
    status = next_status,
    available_at = next_available_at,
    claim_owner = null,
    claim_phase = null,
    lease_expires_at = null,
    completed_at = next_completed_at,
    dead_lettered_at = next_dead_lettered_at,
    manual_retry_eligible = next_manual_retry,
    last_error_category = next_error_category,
    last_error_code = next_error_code,
    updated_at = now()
  where event.id = target_event.id;

  return jsonb_build_object(
    'eventId', target_event.id,
    'status', next_status,
    'attemptNumber', target_event.attempts,
    'manualRetryEligible', next_manual_retry,
    'availableAt', next_available_at
  );
end;
$$;

create function public.manual_retry_m6_outbox_event(
  p_event_id uuid,
  p_reason_code text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_event public.outbox_events%rowtype;
  has_transaction_receipt boolean;
  retry_status text;
begin
  if p_reason_code is null
    or char_length(p_reason_code) not between 1 and 120
    or p_reason_code !~ '^[a-z0-9][a-z0-9._:-]*$'
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid manual retry reason';
  end if;

  select event.*
  into target_event
  from public.outbox_events event
  where event.id = p_event_id
    and event.status in (
      'dead_letter',
      'configuration_blocked',
      'simulation_succeeded',
      'simulation_rejected',
      'reconciliation_failed'
    )
    and event.manual_retry_eligible
  for update;

  if target_event.id is null then
    raise exception using
      errcode = '55000',
      message = 'Outbox event is not eligible for manual retry';
  end if;

  select exists (
    select 1
    from lozzi_private.outbox_event_receipts receipt
    where receipt.outbox_event_id = target_event.id
      and receipt.provider_operation_id is not null
  )
  into has_transaction_receipt;

  retry_status := case
    when has_transaction_receipt then 'reconciliation_failed'
    else 'pending'
  end;

  update public.outbox_events event
  set
    status = retry_status,
    attempts = 0,
    retry_generation = event.retry_generation + 1,
    available_at = now(),
    dead_lettered_at = null,
    completed_at = null,
    manual_retry_eligible = false,
    manual_retry_count = event.manual_retry_count + 1,
    last_error_category = null,
    last_error_code = null,
    updated_at = now()
  where event.id = target_event.id;

  insert into public.audit_events (
    institution_id,
    action,
    entity_type,
    entity_id,
    outcome,
    metadata,
    correlation_id
  )
  values (
    target_event.institution_id,
    'outbox.manual_retry',
    'outbox_event',
    target_event.id,
    'success',
    jsonb_build_object(
      'priorStatus', target_event.status,
      'reasonCode', p_reason_code,
      'retryPhase',
        case
          when has_transaction_receipt then 'reconciliation'
          else 'submission'
        end
    ),
    target_event.correlation_id
  );

  return jsonb_build_object(
    'eventId', target_event.id,
    'status', retry_status,
    'manualRetryCount', target_event.manual_retry_count + 1
  );
end;
$$;

create function public.get_m6_outbox_metrics()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'generatedAt', now(),
    'statusCounts',
      coalesce(
        (
          select jsonb_object_agg(status_count.status, status_count.total)
          from (
            select event.status, count(*)::integer as total
            from public.outbox_events event
            group by event.status
          ) status_count
        ),
        '{}'::jsonb
      ),
    'expiredLeases',
      (
        select count(*)::integer
        from public.outbox_events event
        where event.status = 'processing'
          and event.lease_expires_at <= now()
      ),
    'manualRetryEligible',
      (
        select count(*)::integer
        from public.outbox_events event
        where event.manual_retry_eligible
      ),
    'oldestReadyAt',
      (
        select min(event.available_at)
        from public.outbox_events event
        where event.status in (
          'pending',
          'retry_scheduled',
          'transaction_submitted',
          'confirmation_pending',
          'reconciliation_failed'
        )
          and not event.manual_retry_eligible
      ),
    'receiptStateCounts',
      coalesce(
        (
          select jsonb_object_agg(receipt_count.state, receipt_count.total)
          from (
            select receipt.state, count(*)::integer as total
            from lozzi_private.outbox_event_receipts receipt
            group by receipt.state
          ) receipt_count
        ),
        '{}'::jsonb
      )
  )
$$;

revoke all on function public.claim_m6_outbox_events(
  text,
  text,
  integer,
  integer
) from public, anon, authenticated, service_role;
revoke all on function public.renew_m6_outbox_lease(
  uuid,
  text,
  integer,
  integer
) from public, anon, authenticated, service_role;
revoke all on function public.complete_m6_outbox_event(
  uuid,
  text,
  integer,
  text,
  text,
  integer,
  text,
  text,
  bigint,
  bytea,
  integer,
  integer
) from public, anon, authenticated, service_role;
revoke all on function public.manual_retry_m6_outbox_event(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.get_m6_outbox_metrics()
  from public, anon, authenticated, service_role;

grant execute on function public.claim_m6_outbox_events(
  text,
  text,
  integer,
  integer
) to service_role;
grant execute on function public.renew_m6_outbox_lease(
  uuid,
  text,
  integer,
  integer
) to service_role;
grant execute on function public.complete_m6_outbox_event(
  uuid,
  text,
  integer,
  text,
  text,
  integer,
  text,
  text,
  bigint,
  bytea,
  integer,
  integer
) to service_role;
grant execute on function public.manual_retry_m6_outbox_event(uuid, text)
  to service_role;
grant execute on function public.get_m6_outbox_metrics()
  to service_role;
