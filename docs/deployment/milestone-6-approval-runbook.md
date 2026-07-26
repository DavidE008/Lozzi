# Milestone 6 deployment approval runbook

Status: rehearsal and evidence format only. Do not deploy, fund, sign, submit,
or broadcast by following this document.

This runbook prepares a decision packet for the registry contracts. Deployment
and application activation are separate approval gates. The offline validator
cannot authorize either.

## Gate 0: resolve the deployment design

Stop until all of the following have named owners and evidence:

- exact chain name and chain ID;
- `InstitutionRegistry` and `AcademicRecordRegistry` as the complete batch;
- pinned Git commit, compiler, EVM, optimizer, and dependency lockfile;
- Safe address, exact owners, threshold, and recovery policy;
- protocol administrator, institution administrator, institution signer,
  emergency owner, deployer, and managed relayer addresses;
- primary and operationally independent RPCs;
- confirmation depth, gas limits, fee limits, deployment funding ceiling,
  relayer daily funding ceiling, and maximum total batch cost;
- replacement-contract, migration, incident, and signer-revocation owners.

World Chain Sepolia is a candidate only. Do not infer approval from an ADR,
environment variable, test fixture, chain name, or earlier demo.

## Gate 1: reproduce the build

- Check out the pinned source commit in a clean, isolated checkout.
- Install the exact lockfile dependencies.
- Confirm Solidity `0.8.30`, EVM `cancun`, optimizer enabled, and 200 runs.
- Run Forge formatting, all tests including fuzz and invariants, the contract
  privacy scan, dependency audit, secret scan, and the approved Slither version.
- Run `pnpm deployment:bytecode:check`.
- Independently reproduce each source, creation bytecode, and runtime template
  hash in `deployment/milestone-6/bytecode-fingerprints.json`.
- Record all warnings and findings; a tool warning is not silently waived.

Abort if any build input or hash differs.

## Gate 2: complete an unsigned simulation

Use an isolated fork at an exact block number and hash from the approved chain.
The simulation must not have signing credentials and must not use a broadcast
flag.

For every transaction in sequence:

- decode sender, target, value, data, constructor arguments or method arguments;
- compute the complete calldata/creation-data Keccak-256;
- estimate gas and apply the proposed bounded gas limit;
- execute only inside the fork;
- record created address, emitted commitment-only events, roles, and storage
  readback;
- record the deployed runtime bytecode and Keccak-256;
- confirm the deployment account receives no lasting contract role;
- simulate duplicate/replay rejection, wrong-chain rejection, unauthorized
  signer rejection, institution deactivation, and nonzero-value rejection.

Read the resulting state through a second fork/RPC view where practical. Fill
`simulation-report.template.json` without a raw transaction, signature, RPC
credential, key, salt, student data, or institution commitment preimage.

The report must retain:

```text
broadcast: false
signedTransactionCount: 0
```

Run `pnpm deployment:preflight`. A pass means the packet is internally
consistent and ready for human review only.

## Gate 3: transaction-specific approval

Create one copy of
`docs/deployment/milestone-6-transaction-approval-template.md` per transaction.
The reviewer independently decodes and compares:

- chain ID and fork block;
- sender, nonce plan, target, value, complete data hash, and decoded action;
- source commit, compiler settings, creation hash, expected address, runtime
  hash, gas limit, and fee/funding bounds;
- expected events, roles, state changes, and readback;
- exact failure and abort conditions.

The approval has an ID and expiry and applies to one immutable packet. A changed
field, new block-state dependency, new transaction, reordered transaction, or
expired approval requires a new simulation and approval.

An approval document is not a Safe signature or transaction submission.

## Preflight checklist

- [ ] Target chain and chain ID are explicitly approved.
- [ ] Both RPCs report the same chain and approved fork block.
- [ ] Contract set, order, source commit, compiler, optimizer, and hashes match.
- [ ] Constructor arguments and expected addresses are exact.
- [ ] Safe owners and threshold were verified independently.
- [ ] Governance and relayer matrices contain exact approved addresses.
- [ ] Every call is zero value and within gas, fee, and funding ceilings.
- [ ] Every transaction has a distinct, unexpired approval ID.
- [ ] Simulation covered the exact ordered batch and all reports passed.
- [ ] No secret, key, mnemonic, signature, raw transaction, private record,
      student identifier, institution preimage, or commitment key is present.
- [ ] Incident, signer-revocation, worker-halt, replacement, and migration owners
      acknowledged their responsibilities.
- [ ] `pnpm deployment:preflight` passed in the isolated reviewed checkout.

Any unchecked item is a mandatory stop.

## Post-deployment readback checklist

This checklist describes future verification; it does not authorize the
transactions.

- [ ] Receipt chain ID, sender, target/created address, status, block hash,
      transaction index, value, input hash, gas used, and effective fee match.
- [ ] Required confirmation depth is reached on both RPCs.
- [ ] Runtime bytecode hash at both addresses matches the approved manifest
      through both RPCs.
- [ ] `InstitutionRegistry` `DEFAULT_ADMIN_ROLE` belongs to the approved Safe.
- [ ] The deployer has no unexpected role.
- [ ] `AcademicRecordRegistry.institutionRegistry()` equals the approved
      `InstitutionRegistry` address.
- [ ] Approved institution is active; administrator and signer roles match.
- [ ] No unexpected event, role, balance transfer, or contract creation appears.
- [ ] Source verification matches the pinned commit and compiler settings.
- [ ] One consenting synthetic canary passes simulation, submission,
      confirmation, event reconciliation, and independent readback under a
      separately approved transaction.
- [ ] Application configuration remains disabled until all readback evidence is
      approved.

## Failure-abort checklist

Immediately stop the batch and do not retry automatically if:

- chain ID, fork, RPC, Safe, owner set, threshold, nonce, expected address,
  bytecode, constructor argument, data hash, role, value, gas, fee, funding, or
  approval differs;
- a simulation reverts or emits an unexpected event;
- an RPC disagrees or cannot independently confirm code, receipt, or state;
- the source tree or lockfile differs from the pin;
- an approval is missing, changed, expired, or belongs to another batch;
- a secret, signature, raw transaction, private academic attribute, student
  identifier, commitment preimage, or salt enters an artifact or log;
- a transaction is ambiguous, replaced, pending beyond policy, or may have
  succeeded without durable receipt evidence;
- the Safe or relayer contains broader authority or funding than approved;
- a required reviewer or recovery owner is unavailable.

Preserve evidence, disable the worker/relayer offchain, and follow
`docs/runbooks/milestone-6-incident-recovery.md`. Never resolve an abort by
raising a limit, switching RPCs, changing a nonce, resubmitting, or editing the
packet without a new review.

## Activation is a separate gate

Even after a hypothetical successful deployment and readback, keep
`M6_REGISTRY_MODE=transactions-disabled`. Enabling a managed relayer, funding
it, configuring hosted services, processing the outbox, or submitting a canary
each requires a later explicit approval with its own limits and recovery plan.
