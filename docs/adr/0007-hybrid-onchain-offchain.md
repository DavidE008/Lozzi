# ADR 0007: Hybrid offchain records and onchain commitments

- Status: Accepted
- Date: 2026-07-25

## Context

Academic records require privacy, correction, institutional governance, and
efficient relational queries. Public verification benefits from durable,
independently readable evidence. Publishing student data directly onchain
would create permanent privacy and correlation risks.

## Decision

PostgreSQL is the canonical system of record. Private documents remain
encrypted offchain. Future World Chain Sepolia transactions publish only
domain-separated, institution-scoped, salted commitments and bounded status
metadata.

A record commitment is computed from UTF-8 RFC 8785 canonical JSON plus a
fresh secret salt. Share events are relayed by an authorized institutional
signer following offchain student authorization; no student wallet is
included in the record or grant contract calls.

Milestone 6 introduces versioned opaque identity commitments for event and
registry correlation. `lozzi-institution-v1` binds the deployment environment
and internal institution identifier to a server-held 32-byte secret.
`lozzi-student-v1` binds an internal opaque student identifier to that
institution commitment, environment, and a separate institution-scoped
32-byte secret. Secrets are configuration material: they must never enter
client bundles, event payloads, URLs, logs, analytics, or audit metadata.

The student commitment is deliberately stable within one institution,
environment, and algorithm version so immutable record versions can be
linked to the correct pseudonymous registry subject. That stability exposes
linkability between commitments published by the same institution. It does
not provide anonymity against an operator that already controls the SIS.
Institution and environment separation, plus independently managed secrets,
limit cross-institution and cross-environment correlation.

Algorithm names and positive key versions are stored beside commitments and
are part of the commitment preimage. Secret rotation increments the key
version for future versions and records a server-side mapping between old and
new commitments; it does not rewrite historical academic versions or their
finalized anchors. Operators must retain old key material under the approved
recovery policy for as long as historical commitments need to be reproduced.

## Consequences

Onchain evidence can show that an authorized institution anchored a specific
version without revealing its contents. A verifier still needs a
student-authorized disclosure package to recompute a commitment. PostgreSQL
availability remains necessary for normal SIS workflows, while chain failure
does not block enrollment, grade, or advising operations.
