# ADR 0008: Append-only academic record versioning

- Status: Accepted
- Date: 2026-07-25

## Context

Grades and academic decisions can be corrected, but an institution must
retain who published each state and how the current state relates to prior
states. Destructive updates would weaken auditability and onchain
verification.

## Decision

Published grade records and academic record snapshots are append-only.
Corrections create a new row with a monotonically increasing version and an
explicit link to the prior version. Exactly one version is current for a
given record scope.

The future registry mirrors this relationship using a
`previousVersionCommitment`. A signer cannot publish a successor unless the
provided previous commitment is the currently registered value. Every
mutation requires an idempotency key.

## Consequences

The system can explain provenance and correction history without presenting a
superseded grade as current. Storage grows with changes, so retention and
archival policies will be required later. A mistaken publication cannot be
erased from a public chain; later versions supersede it without exposing the
underlying academic values.
