# Registry contract proposal

## Scope

`InstitutionRegistry` and `AcademicRecordRegistry` are unit-tested foundations
only. They are not deployed.

`InstitutionRegistry` registers opaque institution commitments, grants
institution-scoped administrator and signer roles, supports signer rotation,
and deactivates an institution without iteration.

`AcademicRecordRegistry` accepts pseudonymous student commitments, enforces
version linkage, records grant commitments with expiration and revocation,
and exposes bounded verification reads.

## Security properties

- OpenZeppelin `AccessControl` provides protocol-root role management.
- Every academic mutation checks an active, scoped institutional signer.
- Every write consumes an institution-namespaced idempotency key.
- No enumerable arrays, unbounded loops, proxies, tokens, payable functions,
  delegate calls, or arbitrary external calls exist.
- Events contain commitments and timestamps only.
- A student-approved share request is relayed by the institution signer, so
  no student wallet appears in the transaction parameters or event.
- The source privacy check rejects fixture names, email patterns, institution
  names, and course codes.

Before any deployment, rerun ETHSkills security, testing, and ship guidance;
perform an independent review; confirm World Chain Sepolia chain ID `4801`;
configure a funded multisig-controlled deployment account; simulate; verify
source; and record addresses and transaction hashes in a new ADR.
