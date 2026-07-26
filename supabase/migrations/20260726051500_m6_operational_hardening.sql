create index public_verifier_attempts_occurred_at_idx
  on lozzi_private.public_verifier_attempts (occurred_at desc);

create index record_share_grants_pending_reconciliation_idx
  on public.record_share_grants (updated_at)
  where chain_status in ('anchoring_pending', 'revocation_pending');

create function public.get_m6_operational_metrics()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_m6_outbox_metrics() || jsonb_build_object(
    'staleReconciliationCounts',
      coalesce(
        (
          select jsonb_object_agg(stale.chain_status, stale.total)
          from (
            select
              share_grant.chain_status,
              count(*)::integer as total
            from public.record_share_grants share_grant
            where share_grant.chain_status in (
              'anchoring_pending',
              'revocation_pending'
            )
              and share_grant.updated_at <= now() - interval '15 minutes'
            group by share_grant.chain_status
          ) stale
        ),
        '{}'::jsonb
      ),
    'verifierAttemptOutcomeCounts',
      coalesce(
        (
          select jsonb_object_agg(attempt_count.outcome, attempt_count.total)
          from (
            select
              attempt.outcome,
              count(*)::integer as total
            from lozzi_private.public_verifier_attempts attempt
            where attempt.occurred_at > now() - interval '5 minutes'
            group by attempt.outcome
          ) attempt_count
        ),
        '{}'::jsonb
      ),
    'verifierRateLimitedFingerprints',
      (
        select count(*)::integer
        from (
          select attempt.request_fingerprint_hash
          from lozzi_private.public_verifier_attempts attempt
          where attempt.occurred_at > now() - interval '5 minutes'
          group by attempt.request_fingerprint_hash
          having count(*) >= 20
        ) limited
      )
  )
$$;

revoke all on function public.get_m6_operational_metrics()
  from public, anon, authenticated;
grant execute on function public.get_m6_operational_metrics()
  to service_role;
