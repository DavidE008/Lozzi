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
perform an independent review; select and approve the exact target chain;
configure a funded multisig-controlled deployment account; simulate; verify
source; and record addresses and transaction hashes in a new ADR. World Chain
Sepolia and chain ID `4801` are candidate test configuration only, not an
approved deployment target.

## Milestone 6 adapter boundary

The server-only registry adapter accepts an explicit chain ID rather than
embedding a final network. It requires:

- primary and independent RPC URLs;
- distinct Institution and Academic Record Registry addresses;
- expected runtime bytecode hashes for both contracts;
- a public managed-relayer address for authorization simulation;
- confirmation and gas ceilings; and
- an explicit `simulation-only` mode.

The default mode is `transactions-disabled`. No private key, wallet client,
signing method, raw-transaction method, or broadcast method exists in the
adapter.

Before preparing calldata, both RPCs must agree on the chain, deployed code,
the Academic Record Registry's configured Institution Registry, institution
activity, relayer authorization, and the current record version. The adapter
locally encodes and decodes calldata, simulates the exact call, estimates gas,
and returns a transaction request that is not signable by the adapter.

Receipt inspection revalidates chain and code, checks the exact contract,
calldata fingerprint, transaction hash, status, confirmation count, and one
matching commitment-only event. After the confirmation threshold, primary and
independent contract reads must both match the expected record or grant state.
World identity and ENS names are never treated as evidence that an academic
record is authentic.

A future managed relayer must be separately approved. It must be narrowly
authorized for these two registries, accept the outbox operation key as a
durable idempotency key, enforce per-transaction gas and funding limits, and
return an immutable provider operation ID. This milestone does not configure,
fund, or call such a relayer.
