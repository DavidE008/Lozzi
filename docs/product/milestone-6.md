# Milestone 6: anchoring and controlled sharing

Milestone 6 implements the application and contract foundations for blockchain
anchoring, durable outbox processing, record-version commitments, time-limited
sharing, public verification, revocation, expiration, and operational
reconciliation.

## Delivered

- Transactional outbox production, claiming, retry, reconciliation, and
  dead-letter behavior.
- Server-only registry adapter with two-RPC chain/code validation, simulation,
  gas ceilings, receipt inspection, and post-confirmation readback.
- Versioned record publication, share creation, revocation, expiration, and
  public verifier flows.
- Minimum-disclosure public responses and request-fingerprint rate limiting.
- Database lifecycle, authorization, concurrency, and operational-hardening
  migrations.
- `InstitutionRegistry` and `AcademicRecordRegistry` contract tests, fuzzing,
  invariants, privacy scanning, and reproducible bytecode fingerprints.
- Offline deployment schemas, manifest, unsigned simulation format, governance
  matrix, approval packet, observability, and recovery runbooks.

## Not delivered live

- No contract was deployed.
- No chain was approved.
- No deployer, Safe, relayer, signer, or wallet was configured or funded.
- No hosted Milestone 6 migration was applied.
- No outbox worker was enabled against a live registry.
- No transaction was signed, submitted, broadcast, or reconciled onchain.

The product defaults to `transactions-disabled` and fails closed when live
configuration is absent. Local simulation and demo states are not live
blockchain evidence.

## Exit evidence

The implementation and deployment-preparation pull requests are
[PR #9](https://github.com/DavidE008/Lozzi/pull/9) and
[PR #10](https://github.com/DavidE008/Lozzi/pull/10). The merged `main` Quality
run is
[30189625797](https://github.com/DavidE008/Lozzi/actions/runs/30189625797).

Exact verification totals and remaining deployment gates are recorded in
`docs/verification/milestone-6.md`.
