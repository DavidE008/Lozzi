begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(9);

select ok(
  has_function_privilege(
    'service_role',
    'public.get_m6_operational_metrics()',
    'execute'
  ),
  'service operators can read bounded operational metrics'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.get_m6_operational_metrics()',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.get_m6_operational_metrics()',
    'execute'
  ),
  'browser roles cannot read operational metrics'
);

select has_index(
  'lozzi_private',
  'public_verifier_attempts',
  'public_verifier_attempts_occurred_at_idx',
  'recent verifier metrics have a time-ordered index'
);

select has_index(
  'public',
  'record_share_grants',
  'record_share_grants_pending_reconciliation_idx',
  'pending reconciliation metrics have a partial age index'
);

insert into lozzi_private.public_verifier_attempts (
  request_fingerprint_hash,
  outcome,
  occurred_at
)
select
  decode(repeat('a7', 32), 'hex'),
  'invalid',
  now()
from generate_series(1, 20);

alter table public.record_share_grants
  disable trigger set_record_share_grants_updated_at;

update public.record_share_grants
set
  chain_status = 'revocation_pending',
  updated_at = now() - interval '20 minutes'
where id = '77000000-0000-4000-8000-000000000004';

alter table public.record_share_grants
  enable trigger set_record_share_grants_updated_at;

set local role service_role;

select lives_ok(
  $test$
    select public.get_m6_operational_metrics()
  $test$,
  'the service operator metrics read succeeds'
);

select is(
  (
    public.get_m6_operational_metrics()
      -> 'verifierAttemptOutcomeCounts'
      ->> 'invalid'
  )::integer,
  20,
  'recent verifier abuse attempts are counted by outcome'
);

select is(
  (
    public.get_m6_operational_metrics()
      ->> 'verifierRateLimitedFingerprints'
  )::integer,
  1,
  'fingerprints at the rate-limit threshold are operator-visible'
);

select is(
  (
    public.get_m6_operational_metrics()
      -> 'staleReconciliationCounts'
      ->> 'revocation_pending'
  )::integer,
  1,
  'stale revocation reconciliation is operator-visible'
);

select ok(
  position(
    'a7a7a7a7' in public.get_m6_operational_metrics()::text
  ) = 0,
  'operational metrics do not expose request fingerprints'
);

reset role;

select * from finish();

rollback;
