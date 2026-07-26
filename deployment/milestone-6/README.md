# Milestone 6 deployment preparation

Status: preparation only; not approved for deployment.

This directory defines an offline evidence packet for the Milestone 6
`InstitutionRegistry` and `AcademicRecordRegistry`. It does not contain a
private key, signer, wallet client, Safe proposal, raw transaction, RPC call,
deployment command, or broadcast path.

The target chain is deliberately unresolved. World Chain Sepolia is only a
candidate in the architecture documents. The templates must remain
`candidate`, `unapproved`, and `not-run` until a later decision approves the
exact chain, governance, signer, funding, and transaction batch.

## Files

- `chain-config.schema.json` defines the versioned chain configuration shape.
- `chain-config.template.json` records the unresolved chain-selection gate.
- `manifest.schema.json` defines contracts, constructor inputs, governance,
  relayer authorization, funding ceilings, and the ordered transaction batch.
- `manifest.template.json` pins the reviewed source and reproducible creation
  bytecode hashes but intentionally leaves deployment-dependent values unset.
- `bytecode-fingerprints.json` records Keccak-256 fingerprints reproduced from
  the pinned Forge build. A runtime template hash is not a deployed runtime
  hash when constructor immutables exist.
- `simulation-report.schema.json` defines unsigned fork-simulation evidence.
- `simulation-report.template.json` is intentionally marked `not-run`.

The supporting review documents are:

- `docs/deployment/milestone-6-constructor-arguments.md`
- `docs/deployment/milestone-6-governance-matrix.md`
- `docs/deployment/milestone-6-approval-runbook.md`
- `docs/deployment/milestone-6-transaction-approval-template.md`

## Offline checks

After building the contracts with the pinned compiler:

```text
pnpm deployment:bytecode:check
pnpm deployment:preflight
```

The bytecode check compares local Forge artifacts with the tracked fingerprint
record. The preflight command is read-only and intentionally fails against the
repository templates because approval, exact addresses, RPCs, runtime hashes,
funding bounds, and unsigned simulation evidence remain unresolved.

Copy the templates into a separately reviewed evidence packet before filling
them. Do not put secret material in either the repository or the packet. The
preflight rejects fields named like private keys, mnemonics, signatures, raw
transactions, credentials, or secrets.

## Approval boundary

A structurally valid JSON document is not approval. A passing preflight means
only that the offline packet is internally consistent and ready for
transaction-specific human review. It does not authorize funding, signing,
Safe submission, broadcast, deployment, source verification, hosted
configuration, or worker enablement.
