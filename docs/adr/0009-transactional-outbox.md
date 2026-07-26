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

## Consequences

The SIS transaction succeeds independently of a partner outage and can
reconcile later. Workers require operational monitoring, retry ceilings, and
dead-letter procedures. Milestones 0–1 define the schema and interfaces but
do not run a relayer or claim a partner success.
