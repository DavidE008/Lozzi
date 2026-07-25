# Milestone 3 acceptance evidence

## Delivered scope

- Deterministic, typed enrollment eligibility in `@lozzi/domain`.
- A six-course Fall 2026 registration catalog backed by hosted PostgreSQL rows.
- Search, department/credit/open filters, sorting, course disclosures,
  eligibility evidence, an in-memory plan, and atomic submission.
- A read-only student schedule with deadline-aware, idempotent withdrawal.
- Institution-scoped registrar registration activity.
- Final-seat locking, duplicate-request replay, audit events, and RLS-scoped
  registration request history.
- A complete synthetic development/testing/demo account matrix in
  [test-accounts.md](../testing/test-accounts.md).

## Hosted database

The dedicated synthetic-only Lozzi project (`mmyndcqtovqxyoucrfdb`) remains in
`eu-west-2` at the confirmed `$0/month` price. The Milestone 3 schema changes
were applied in order:

1. `registration_vertical_slice`
2. `registration_transactions`
3. `registration_oversight_view`
4. `fix_registration_term_resolution`
5. `scope_registrar_summary_to_current_term`
6. `registration_request_fk_indexes`
7. `qualify_registration_enrollment_conflict`

The hosted probes confirm:

- Mateo satisfies the CS 1301 prerequisite and is eligible for the final CS
  2305 seat.
- The active registration catalog exposes exactly six Fall 2026 offerings.
- The corrected registration function resolves a UUID term without relying on
  a nonexistent PostgreSQL `min(uuid)` aggregate.
- Enrollment upserts name their unique constraint explicitly, eliminating the
  PL/pgSQL variable/column ambiguity proven by the registration test.
- The registrar summary and registration activity views use
  `security_invoker`.
- Registration request foreign keys have complete covering indexes.

The pgTAP suite proves self-only registration access, hold and prerequisite
denials, successful registration, idempotent replay, atomic seat accounting,
withdrawal and seat release, hidden student audit rows, registrar oversight,
and registrar denial from student-only RPCs. A separate API-level concurrency
test races two eligible students for one seat and requires exactly one winner
and one `SECTION_FULL` result.

## Advisor review

The performance advisor reports zero unindexed foreign keys after the final
index migration. Its remaining unused-index notices are expected for a newly
seeded synthetic dataset; integrity, authorization, and workload indexes are
retained.

The security advisor reports four intentionally exposed authenticated
`SECURITY DEFINER` registration RPCs. These are the designed Data API boundary:
each pins an empty `search_path`, rejects a missing `auth.uid()`, derives the
student from active database membership, bounds section arrays, scopes every
read/write, and grants no anonymous execution. The warning is documented
rather than suppressed. See the [Supabase security-definer advisor
guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

The remaining project-level warning is leaked-password protection, which is
not available through the connected project-management surface and remains an
explicit configuration task. See [Supabase password protection
guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Application and browser verification

- ESLint and strict TypeScript pass.
- Vitest passes 12 domain tests and 18 web tests.
- The Next.js 16.2.11 production build succeeds with the registration,
  schedule, and registrar-oversight routes.
- Dependency audit reports no known production vulnerability, and the
  repository secret scan passes.
- The in-app browser verified real hosted Aisha data, filters, course
  expansion, plan add/remove, submit enablement, the `390 × 844` responsive
  layout, the mobile navigation drawer, and zero console errors.
- The approved registration concept and final browser capture were compared in
  the same full-view and focused-region inputs. The iteration history and
  passing result are recorded in [design-qa.md](../../design-qa.md).
- [GitHub Actions Quality run 32](https://github.com/DavidE008/Lozzi/actions/runs/30146711121)
  is the authoritative Docker/pgTAP,
  final-seat-concurrency, Playwright, Foundry, frozen-install, format, build,
  audit, and secret-scanning record.

Local Docker is unavailable on this Windows workstation, so the GitHub
container job remains the authoritative database reset and pgTAP environment.

## Deliberate limitations and later credentials

Waitlist promotion, registrar overrides, enrollment appointments, multi-section
demo density, grade submission/publication, record correction, and
credential-sharing workflows remain later milestones. No contract or partner
integration was deployed.

The repository still contains no World App ID, ENS Sepolia parent or adapter
key, 0G Compute Router credential, WalletConnect project ID, World Chain
Sepolia RPC or funded signer, explorer configuration, object key-wrapping
provider key, or production Supabase secret.
