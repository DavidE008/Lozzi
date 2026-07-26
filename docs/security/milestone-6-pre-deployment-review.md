# Milestone 6 independent pre-deployment review

Status: required gate, not completed. Passing local tests or this checklist is
not an external audit and does not establish production readiness.

The reviewer must be independent of the transaction preparer. Record reviewer
identity, pinned Git commit, date, evidence links, unresolved findings, and an
explicit approve/reject decision. A checklist item may not be waived without a
written risk owner and expiry.

## Scope and privacy

- [ ] Confirm the exact target chain, chain ID, contracts, constructor
      arguments, compiler, optimizer settings, and source commit.
- [ ] Confirm bytecode hashes are independently reproduced from the pinned
      source.
- [ ] Confirm events, calldata, and storage contain only commitments, opaque
      identifiers, expiration, authorization, and lifecycle state.
- [ ] Confirm no name, email, student ID, wallet-to-student mapping, course,
      grade, major, date of birth, transcript content, token, salt, or private
      disclosure is included.
- [ ] Reproduce deterministic commitment vectors and review institution,
      environment, algorithm, and key-version domain separation.
- [ ] Accept or reject the within-institution linkability of stable student
      commitments and document the rotation/migration owner.

## Authorization and governance

- [ ] Independently verify the proposed Safe address, owners, threshold,
      recovery expectations, and separation from unrelated assets.
- [ ] Verify protocol administrator, institution administrator, institutional
      signer, managed relayer, deployer, and emergency roles against the
      approved matrix.
- [ ] Confirm relayer authorization is limited to the approved registries,
      methods, chain, gas bounds, and funding ceiling.
- [ ] Rehearse signer revocation, institution deactivation, relayer halt, and
      Safe rejection using unsigned simulation evidence.
- [ ] Confirm no raw private key is the preferred production design and no key
      material appears in Git, logs, client bundles, environment evidence, or
      approval packets.

## Contract and transaction evidence

- [ ] Run `forge fmt --check`, all unit/fuzz/invariant tests, the contract
      privacy scan, and Slither 0.11.5 or a separately approved pinned version.
- [ ] Review every Slither finding; store tool version, exact command, and
      disposition. A clean tool result is not a substitute for manual review.
- [ ] Confirm `InstitutionRegistry` administration and deactivation remain
      appropriately scoped.
- [ ] Confirm `AcademicRecordRegistry` remains append-only and stores no
      disclosure payload.
- [ ] Independently decode every proposed transaction and compare target,
      value, calldata, gas bound, nonce, chain ID, and expected events with the
      approval packet.
- [ ] Confirm simulation succeeds against the intended state and that a
      mismatched chain, code hash, event, receipt, or readback fails closed.
- [ ] Confirm primary and independent RPC readback agree.

## Operations and recovery

- [ ] Exercise duplicate-worker, stale-lease, crash recovery, retry ceiling,
      dead-letter, idempotent replay, and failed-reconciliation paths.
- [ ] Verify alert delivery for every condition in
      `docs/operations/milestone-6-observability.md`.
- [ ] Rehearse the worker halt and read-only reconciliation procedures.
- [ ] Approve the replacement-contract and data-migration strategy before the
      first transaction.
- [ ] Confirm the incident owner understands that a finalized transaction
      cannot be rolled back; recovery is a new governed transaction plus
      canonical offchain state and reconciliation.

## Approval boundary

Completion of this review produces evidence only. Deployment, funding,
signature collection, Safe submission, broadcast, provisioning, and hosted
configuration each require a later explicit approval.
