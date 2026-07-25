# Milestone 4 acceptance evidence

## Delivered scope

- Assigned-instructor section and roster views backed by hosted PostgreSQL rows.
- Deterministic `10% / 40% / 50%` component calculations with a bounded grade
  scale.
- Idempotent draft save, section submit, registrar approval, publication, and
  correction transactions.
- Append-only grade and academic-record version chains with exactly one current
  version.
- Registrar publication and correction controls.
- Student official-record history, anchor capability state, GPA, and
  requirement-level degree progress.
- Instructor, registrar, student, and mobile end-to-end journeys.

## Hosted database

The synthetic-only Lozzi project (`mmyndcqtovqxyoucrfdb`) remains in
`eu-west-2`. The following Milestone 4 migrations were applied in order:

1. `grade_lifecycle_and_progress`
2. `grade_lifecycle_transactions`
3. `academic_record_progress_views`
4. `cover_grade_actor_foreign_keys`
5. `repair_grade_schedule_encoding`

Hosted transaction-and-rollback verification passes all 50 grade, record,
correction, authorization, audit, and degree-progress assertions. The 38 prior
registrar permission assertions also pass after normalizing the legacy
synthetic record that was already official but still carried an `approved`
submission state.

Authenticated hosted probes confirm:

- Elena sees her assigned sections, three historical/current gradebook rows,
  and Aisha's current CS 2305 draft.
- James receives zero rows for Elena's CS 2305 section.
- Aisha sees one current official record, one current degree audit, and a 4.00
  GPA.
- Jordan sees both current official synthetic course outcomes and no
  submitted/approved item before the instructor submits the current draft.

## Security and advisor review

All grade mutations are authenticated `SECURITY DEFINER` RPC boundaries by
design. Each pins an empty `search_path`, rejects a missing `auth.uid()`,
derives authorization from active database membership or section assignment,
validates bounded inputs, uses idempotency records, and emits PII-free audits.
Anonymous execution and direct authenticated writes to grade, record-version,
and degree-audit tables are revoked.

The security advisor therefore reports the intentional authenticated-RPC
warning plus the existing project-level leaked-password-protection setting.
The latter remains an explicit Supabase Auth configuration task. The
performance advisor reports no unindexed grade-submission foreign keys after
the actor-index migration; remaining notices are informational unused-index
observations expected for a newly seeded synthetic workload.

## Application and design verification

- Formatting passes for every Milestone 4 file.
- ESLint and strict TypeScript pass across the monorepo.
- Vitest passes 19 domain tests and 25 web tests.
- The Next.js 16.2.11 production build succeeds for all instructor, registrar,
  and student routes.
- The production dependency audit reports no known vulnerability, the secret
  scan passes, and the contract privacy scan passes.
- Local Foundry execution is unavailable on this Windows workstation; the
  GitHub `Contracts` job is the authoritative Foundry result.
- Docker is unavailable locally; the GitHub `Database` job is the
  authoritative clean reset, pgTAP, and database-lint result.
- Browser QA at `1536 × 1024` and `390 × 844` verifies live calculation,
  mobile navigation, responsive table behavior, valid controls, and zero
  console warnings or errors.
- The approved reference and implementation were inspected in one side-by-side
  comparison. The fidelity checks and passing result are recorded in
  [design-qa.md](../../design-qa.md).

## Deliberate limitations and later credentials

No World, ENS, 0G, wallet, or chain integration is claimed live. Academic
payloads remain private and offchain, and the visible anchor state is honestly
`not configured`.

Later deployment still requires a World App ID, Ethereum Sepolia ENS
parent/adapter authorization, 0G Compute Router credential, WalletConnect
project ID, World Chain Sepolia RPC and funded institutional signer, explorer
configuration, and a production object-key-wrapping provider key. No contract
was deployed in Milestone 4.
