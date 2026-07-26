# Milestone 6 observability

Status: local and simulation-only. These signals do not authorize a worker,
relayer, signer, deployment, or transaction.

## Metrics boundary

`get_m6_operational_metrics()` is executable only by the service role. It
returns counts and timestamps, never bearer tokens, request fingerprints,
commitment salts, signatures, raw RPC responses, or academic payloads.

The snapshot includes:

- outbox status, receipt state, expired lease, manual retry, and oldest-ready
  counts;
- share lifecycle, access result, reconciliation, and stale-reconciliation
  counts;
- verifier attempt outcomes from the last five minutes and the number of
  opaque fingerprints at the rate-limit threshold.

`evaluateOperationalAlerts()` converts that snapshot into stable alert codes.
An operator dashboard may render these codes, but it must not attach private
event payloads or query the private attempt tables.

## Alert conditions

| Severity | Condition                                                    | First response                                                                            |
| -------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Critical | Any dead-letter event                                        | Halt the worker, preserve evidence, and inspect the immutable attempt history.            |
| Critical | Any reconciliation-failed receipt                            | Halt submission for the affected registry and perform independent readback.               |
| Critical | Oldest ready work is at least 15 minutes old                 | Treat the worker or dependency as unavailable and stop new submission.                    |
| Warning  | Oldest ready work is at least 5 minutes old                  | Check worker health, leases, RPC availability, and queue growth.                          |
| Warning  | Any expired lease                                            | Confirm the prior worker is stopped before allowing stale-lease recovery.                 |
| Warning  | Any manual-retry-eligible event                              | Require an operator to classify the failure before the audited retry RPC is used.         |
| Warning  | Any share reconciliation pending for at least 15 minutes     | Preserve offchain denial and independently inspect chain state.                           |
| Warning  | Any verifier fingerprint reaches 20 attempts in five minutes | Check abuse volume without attempting to identify the person from the opaque fingerprint. |

Alert thresholds are initial operating values, not a production SLO. Changing
them requires evidence from a synthetic environment and privacy review.

## Retention and review

Verifier attempt rows are private abuse-control material. A future retention
job must be bounded, separately approved, and must not delete
`record_share_access_logs`, outbox attempts, audit evidence, or transaction
receipts. No scheduler or hosted retention mutation is configured in this
milestone.
