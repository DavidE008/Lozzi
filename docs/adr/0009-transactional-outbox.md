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

## Consequences

The SIS transaction succeeds independently of a partner outage and can
reconcile later. Workers require operational monitoring, retry ceilings, and
dead-letter procedures. Milestones 0–1 define the schema and interfaces but
do not run a relayer or claim a partner success.
