# Milestones 0–1 acceptance evidence

## Hosted data

- Supabase project: `Lozzi` (`mmyndcqtovqxyoucrfdb`)
- Organization: `datata001@outlook.com's Org`
- Region: `eu-west-2`
- Confirmed project price: `$0/month`
- Data classification: synthetic only

Hosted authorization probes verified:

- Aisha can read exactly her student row and 4.00/3-of-120 dashboard summary.
- Assigned instructor Elena sees one scoped roster; unrelated instructor
  James sees none.
- Assigned advisor Casey sees Aisha.
- Registrar Jordan sees three Northstar students and no other institution.
- A valid share token resolves only its approved scope.
- Wrong-scope, expired, and revoked share tokens resolve no fields.
- Anonymous users have no domain-table grants.

## Database advisors

After the final migrations, the security advisor reports no schema errors.
Its sole warning is project-level leaked-password protection, which is not
enabled on the zero-cost synthetic demo project. Direct access to outbox and
idempotency tables is explicitly denied by policy.

The performance advisor reports no warnings. Its remaining informational
items are unused-index observations expected for a newly seeded dataset;
foreign-key indexes are retained because they protect referential checks and
future authorization workloads.

References:

- [Security advisor: RLS policy guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Password protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [Foreign-key index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)

## Local verification

- Frozen install, Prettier, ESLint, strict TypeScript, Vitest, production
  Next.js build, dependency audit, and repository secret scan pass.
- 13 Foundry tests pass across two registries.
- Playwright passes protected-route denial plus desktop and mobile sign-in,
  hosted dashboard data, navigation, and logout.
- Browser screenshots and eight direct concept-fidelity checks are recorded in
  [`../design/fidelity-review.md`](../design/fidelity-review.md).

Local Docker was unavailable on the Windows workstation. The required
`supabase db reset`, pgTAP suite, and database lint therefore run in the
GitHub Actions Docker environment before merge.
