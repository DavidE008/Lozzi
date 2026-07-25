# Milestone 2 acceptance evidence

## Delivered scope

- Role-aware routing for student, registrar, and institution-administrator
  homes.
- Institution-scoped academic catalog, term, section, instructor, meeting,
  membership, and staff-role administration.
- An approved-design registrar overview plus students, records, audit, and
  settings destinations.
- Zod-validated Server Actions with same-origin checks, database-derived role
  enforcement, RLS as the final authority, and PII-free mutation logging.
- Deactivation instead of destructive deletion and append-only audit events.

## Hosted database

The dedicated synthetic-only `Lozzi` Supabase project
(`mmyndcqtovqxyoucrfdb`) remains in `eu-west-2` at the confirmed `$0/month`
price. The Milestone 2 migrations were applied in order:

1. `academic_structure_tenant_integrity`
2. `academic_structure_write_authorization`
3. `registrar_workspace_views_and_audit`
4. `cover_academic_structure_audit_foreign_keys`

An authenticated Jordan Lee probe returned Northstar University, Fall 2026,
registration open, three active students, two course sections, one approved
record awaiting publication, and one attention item.

The database permission suite proves institution-scoped registrar reads and
writes, institution-administrator-only identity administration, cross-tenant
denial, instructor assignment boundaries, and deactivation behaviour. All
authorization derives from memberships and staff assignments rather than
user-editable metadata.

## Advisor review

The security advisor reports no schema-level security defect. Its sole warning
is the project-level leaked-password protection setting, which is unavailable
through the connected project-management surface and remains an explicit
configuration task. See [Supabase password protection
guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

The performance advisor's six unindexed audit foreign keys were remediated by
the final migration. Remaining informational items are unused-index notices
expected for a newly seeded dataset; integrity and authorization indexes are
retained for their intended workloads. See [Supabase foreign-key index
guidance](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

## Application and browser verification

- ESLint and strict TypeScript pass after the final responsive-layout fix.
- Vitest passes 12 web tests and 8 domain tests.
- The production Next.js build succeeds with every registrar route.
- Playwright passes 8 applicable journeys with 4 intentional cross-project
  skips: protected-route denial, hosted role sign-in, real seeded data,
  destination navigation, mobile navigation, and logout.
- The in-app browser verified the desktop overview, 390-pixel mobile layout,
  accessible navigation sheet, disabled publication state, and absence of
  horizontal desktop overflow.
- The approved concept and implementation were inspected together. Eight
  fidelity checks are recorded in
  [the registrar fidelity review](../design/registrar-fidelity-review.md).

Local Docker is unavailable on this Windows workstation. GitHub Actions remains
the authoritative environment for migration reset, pgTAP, database lint,
Foundry, frozen install, formatting, build, audit, and secret-scanning gates.

## Deliberate limitations and later credentials

Registration eligibility and enrollment mutations remain Milestone 3. Grade
submission, record publication, corrections, and version workflows remain
Milestone 4. No contract or partner integration was deployed.

The repository still contains no World App ID, ENS Sepolia parent or adapter
key, 0G Compute Router credential, WalletConnect project ID, World Chain
Sepolia RPC or funded signer, explorer configuration, or object key-wrapping
provider key.
