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

## Consequences

Onchain evidence can show that an authorized institution anchored a specific
version without revealing its contents. A verifier still needs a
student-authorized disclosure package to recompute a commitment. PostgreSQL
availability remains necessary for normal SIS workflows, while chain failure
does not block enrollment, grade, or advising operations.
