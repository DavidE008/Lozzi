grant execute on function lozzi_private.m6_valid_share_scope_array(text[])
  to service_role;

create or replace function public.revoke_sensitive_share_with_outbox(
  p_share_grant_id uuid,
  p_idempotency_key uuid,
  p_trace_id uuid,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  grant_row public.record_share_grants%rowtype;
  event_payload jsonb;
  reconciliation_queued boolean := false;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_idempotency_key is null
    or p_trace_id is null
    or p_correlation_id is null
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid share revocation request';
  end if;

  select share_grant.*
  into grant_row
  from public.record_share_grants share_grant
  join public.students student on student.id = share_grant.student_id
  where share_grant.id = p_share_grant_id
    and student.user_id = caller_id
    and student.institution_id = share_grant.institution_id
  for update of share_grant;

  if grant_row.id is null then
    raise exception using
      errcode = '42501',
      message = 'Authorized share grant not found';
  end if;

  if grant_row.status = 'revoked' or grant_row.revoked_at is not null then
    select exists (
      select 1
      from public.outbox_events event
      where event.aggregate_id = grant_row.id
        and event.event_type = 'share_grant.revoke.requested.v1'
    )
    into reconciliation_queued;

    return jsonb_build_object(
      'chainStatus', grant_row.chain_status,
      'idempotentReplay', true,
      'reconciliationQueued', reconciliation_queued,
      'revokedAt', grant_row.revoked_at,
      'shareGrantId', grant_row.id,
      'status', 'revoked'
    );
  end if;

  if grant_row.status = 'expired' or grant_row.expires_at <= now() then
    return jsonb_build_object(
      'chainStatus', grant_row.chain_status,
      'expiresAt', grant_row.expires_at,
      'idempotentReplay', true,
      'reconciliationQueued', false,
      'status', 'expired'
    );
  end if;

  update public.record_share_grants share_grant
  set
    status = 'revoked',
    revoked_at = now(),
    chain_status = case
      when share_grant.chain_status in (
        'anchoring_pending',
        'anchored',
        'anchor_failed'
      ) then 'revocation_pending'
      else share_grant.chain_status
    end,
    updated_at = now()
  where share_grant.id = grant_row.id
  returning share_grant.* into grant_row;

  reconciliation_queued :=
    grant_row.institution_commitment is not null
    and grant_row.student_commitment is not null
    and grant_row.commitment_environment is not null
    and grant_row.institution_commitment_algorithm is not null
    and grant_row.institution_commitment_key_version is not null
    and grant_row.student_commitment_algorithm is not null
    and grant_row.student_commitment_key_version is not null;

  if reconciliation_queued then
    event_payload := jsonb_build_object(
      'commitmentEnvironment', grant_row.commitment_environment,
      'grantCommitment', '0x' || encode(grant_row.grant_commitment, 'hex'),
      'institutionCommitment',
        '0x' || encode(grant_row.institution_commitment, 'hex'),
      'institutionCommitmentAlgorithm',
        grant_row.institution_commitment_algorithm,
      'institutionCommitmentKeyVersion',
        grant_row.institution_commitment_key_version,
      'revokedAt', grant_row.revoked_at,
      'shareGrantId', grant_row.id,
      'studentCommitment',
        '0x' || encode(grant_row.student_commitment, 'hex'),
      'studentCommitmentAlgorithm', grant_row.student_commitment_algorithm,
      'studentCommitmentKeyVersion',
        grant_row.student_commitment_key_version
    );

    perform lozzi_private.enqueue_m6_outbox_event(
      grant_row.institution_id,
      'record_share_grant',
      grant_row.id,
      'share_grant.revoke.requested.v1',
      event_payload,
      p_idempotency_key,
      p_trace_id,
      p_correlation_id
    );
  end if;

  insert into public.audit_events (
    institution_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    outcome,
    metadata,
    correlation_id
  )
  values (
    grant_row.institution_id,
    caller_id,
    'share.sensitive.revoke',
    'record_share_grant',
    grant_row.id,
    'success',
    jsonb_build_object(
      'chainStatus', grant_row.chain_status,
      'reconciliationQueued', reconciliation_queued,
      'revokedAt', grant_row.revoked_at,
      'scopes', grant_row.scopes
    ),
    p_correlation_id
  );

  return jsonb_build_object(
    'chainStatus', grant_row.chain_status,
    'idempotentReplay', false,
    'reconciliationQueued', reconciliation_queued,
    'revokedAt', grant_row.revoked_at,
    'shareGrantId', grant_row.id,
    'status', 'revoked'
  );
end;
$$;

create or replace function public.get_m6_outbox_metrics()
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
      ),
    'shareLifecycleCounts',
      coalesce(
        (
          select jsonb_object_agg(lifecycle.status, lifecycle.total)
          from (
            select
              case
                when share_grant.status = 'revoked'
                  or share_grant.revoked_at is not null
                  then 'revoked'
                when share_grant.status = 'expired'
                  or share_grant.expires_at <= now()
                  then 'expired'
                else 'active'
              end as status,
              count(*)::integer as total
            from public.record_share_grants share_grant
            group by 1
          ) lifecycle
        ),
        '{}'::jsonb
      ),
    'shareReconciliationCounts',
      coalesce(
        (
          select jsonb_object_agg(
            reconciliation.chain_status,
            reconciliation.total
          )
          from (
            select
              share_grant.chain_status,
              count(*)::integer as total
            from public.record_share_grants share_grant
            group by share_grant.chain_status
          ) reconciliation
        ),
        '{}'::jsonb
      ),
    'shareAccessResultCounts',
      coalesce(
        (
          select jsonb_object_agg(access_count.access_result, access_count.total)
          from (
            select
              access_log.access_result,
              count(*)::integer as total
            from public.record_share_access_logs access_log
            group by access_log.access_result
          ) access_count
        ),
        '{}'::jsonb
      )
  )
$$;
