# ADR 0009: Transactional outbox for external effects

- Status: Accepted
- Date: 2026-07-25

## Context

Later milestones will anchor commitments, create ENS subnames, store encrypted
objects, and request private inference. These systems cannot participate in a
PostgreSQL transaction, and retries can produce duplicate side effects.

## Decision

Write an outbox event in the same database transaction as the authoritative
domain change. A future server-side worker claims available events, calls a
typed provider adapter, and records a terminal or retryable outcome.

Every operation has a unique idempotency key. Provider state is one of
`available`, `mock-development`, `not-configured`, or `failed`. Mocks are
development-only and visibly labeled. Browser code never calls the 0G Direct
SDK or holds an institutional signer.

Milestone 6 producers emit three schema-versioned logical events:
`academic_record.anchor.requested.v1`,
`share_grant.create.requested.v1`, and
`share_grant.revoke.requested.v1`. The event row stores its aggregate,
institution, schema version, idempotency key, trace ID, correlation ID, and
attempt state separately from a strictly bounded commitment-only payload.
Unique logical-event and institution-scoped idempotency indexes make retries
converge on the original event.

Academic publication and share activation use authenticated wrapper
functions around the earlier transaction implementations. Direct execution
of the non-enqueueing implementations is revoked from application roles.
The wrapper writes the domain state, versioned opaque identity, audit record,
and outbox event inside one PostgreSQL transaction; an enqueue failure rolls
the whole statement back. Share revocation denies offchain access in that
same transaction before asynchronous reconciliation is attempted.

Commitment root secrets remain server-only configuration. Application code
derives separate institution-scoped material for institution and student
commitments and sends only the resulting bytes32 values and key versions to
PostgreSQL. Missing or malformed commitment configuration fails closed.
Outbox creation does not mean a blockchain transaction was prepared,
submitted, or confirmed.

The server-only worker foundation is disabled unless
`M6_OUTBOX_WORKER_ENABLED=1` and a bounded worker ID, batch size, and lease
duration are valid. Claims use `FOR UPDATE SKIP LOCKED`, a named owner, a
five-to-300-second lease, and a batch ceiling of 50. A stale lease closes the
prior private attempt record before another worker can reclaim it. A clean
abort releases every already-claimed event into bounded retry rather than
leaving an unbounded process loop.

Submission and reconciliation are separate claim phases. Transaction
submission can only move to reconciliation after a structured provider
operation receipt is stored. Submitted events are never eligible for another
submission claim. Completion is idempotent for the same worker, attempt, and
outcome; a conflicting replay is rejected. Retry ceilings produce dead-letter
state and require an explicit, audited manual retry. Manual retry increments a
generation so immutable attempt history is retained while the bounded attempt
number restarts.

Attempt details and provider receipts live in `lozzi_private` tables that are
not directly readable by application or service roles. Service-only
security-definer RPCs expose bounded claims, completion, renewal, manual retry,
and aggregate metrics. Error persistence is restricted to validated category
and code values; raw exceptions, RPC bodies, bearer material, private records,
and signatures are not persisted.

## Consequences

The SIS transaction succeeds independently of a partner outage and can
reconcile later. Workers require operational monitoring, retry ceilings, and
dead-letter procedures. Milestones 0–1 define the schema and interfaces but
do not run a relayer or claim a partner success.

This foundation does not sign or broadcast transactions. A future managed
relayer must accept the outbox idempotency key as its provider operation key
and durably return that operation ID before any transaction-capable worker can
be enabled. Until that separately approved design exists, handlers are limited
to configuration checks, simulation, and read-only reconciliation.
