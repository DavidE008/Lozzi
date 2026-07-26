# Milestone 6 incident and recovery runbook

Status: rehearsal-only. No live relayer, signer, registry deployment, or worker
is configured.

## Containment

1. Set `M6_OUTBOX_WORKER_ENABLED` to disabled in the affected runtime and stop
   every worker instance. Do not clear leases by editing tables.
2. Disable the separately approved relayer policy if one exists. Do not rotate
   or revoke a signer until the exact governance transaction is independently
   reviewed and approved.
3. Preserve outbox rows, private attempt history, receipts, audit events,
   application logs, deployment manifests, simulations, and RPC observations.
   Never copy bearer tokens, salts, keys, raw academic records, or signatures
   into the incident record.
4. Keep PostgreSQL canonical. Revoked or expired shares remain denied offchain
   even if chain reconciliation fails.

## Triage

Classify the incident:

- **Worker halt or duplicate execution:** compare worker IDs, leases, attempt
  numbers, idempotency keys, provider operation IDs, and terminal outcomes.
- **Relayer compromise:** identify the permitted target/method/value/gas range,
  stop funding and authorization through the approved control plane, and
  inspect every transaction independently.
- **Signer compromise:** halt the relayer and prepare signer revocation or
  institution deactivation for Safe/governance review. Never expose or attempt
  to retrieve the compromised key.
- **RPC inconsistency:** quarantine the disagreeing endpoint, compare chain ID,
  block hash, bytecode, receipt, events, and state through the independent RPC.
- **Verifier abuse:** use only aggregate outcomes and opaque fingerprint counts;
  do not attempt identity enrichment.
- **Hosted SIS or disclosure failure:** stop public verification if canonical
  share state, frozen scopes, or disclosure packages cannot be read reliably.
  Onchain commitments alone do not reconstruct or authenticate academic data.

## Reconciliation

1. Select one event and its immutable aggregate, event type, schema version,
   institution, idempotency key, and receipt state.
2. Validate the event with the versioned schema. Malformed or unknown versions
   are non-retryable and remain preserved for review.
3. Read chain ID, deployed bytecode, receipt, confirmation count, expected
   commitment-only event, and registry state from primary and independent RPCs.
4. If no provider operation was recorded, a separately approved simulation may
   be repeated. If an operation or transaction hash exists, do not submit a
   duplicate; reconcile that operation.
5. Use manual retry only after the error is classified, the retry generation is
   audited, and the incident owner approves. Never change canonical share
   access from chain state.

## Recovery decisions

### Safe and signer governance

The assumed production model is a dedicated Safe with independently controlled
owners and an approved threshold. Exact owners, threshold, recovery policy,
signer revocation transaction, and relayer limits are unresolved deployment
inputs. A signer revocation or institution deactivation is a new onchain
transaction and therefore requires transaction-specific review and approval.

### Replacement contract

The registries are intentionally non-upgradeable. Replacement requires a new
contract deployment, new bytecode approval, explicit authority configuration,
and a cutover manifest. The old registry remains historical evidence. Clients
must never silently follow an unapproved address.

### Data migration

PostgreSQL retains canonical record versions, share state, commitment algorithm,
key version, environment, and outbox history. Migration creates new events that
refer to immutable existing versions; it does not rewrite academic history or
reuse an incompatible salt/key version. Run a synthetic canary and independently
verify every migrated commitment before enabling additional work.

### Finality limitation

A finalized transaction cannot be rolled back. Recovery may revoke authority,
deactivate an institution, revoke a share, or publish a replacement commitment
through a new governed transaction. The original public transaction and its
linkability remain permanent.

## Residual risks

- Stable student commitments are linkable within one institution,
  environment, algorithm, and key version.
- A compromised relayer can misuse whatever narrow methods, gas, and funding
  it has been granted until authorization is removed.
- Primary and independent RPCs may share upstream infrastructure or disagree
  during reorganization and outage.
- Public disclosure depends on the hosted SIS remaining available and correct;
  chain evidence is commitment evidence, not a transcript database.
- Safe security depends on owner independence, threshold selection, device
  hygiene, and a rehearsed recovery process.

This runbook has not been externally audited.
