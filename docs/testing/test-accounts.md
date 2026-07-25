# Synthetic test accounts

> Public demo credentials — synthetic data only. Never reuse these passwords,
> attach real student information, or enable these accounts in a production
> tenant. Privileged demo accounts must be disabled before any production launch.

All accounts belong to the fictional **Northstar University** tenant.

| Person         | Role       | Email                            | Password               | Primary test use                                 |
| -------------- | ---------- | -------------------------------- | ---------------------- | ------------------------------------------------ |
| Aisha Rahman   | Student    | `aisha.demo@lozzi.example`       | `Northstar-Demo-2026!` | Completed prerequisite, current enrollment       |
| Mateo Silva    | Student    | `mateo.demo@lozzi.example`       | `Synthetic-Only-2026!` | Eligible registration and final-seat concurrency |
| Priya Nair     | Student    | `priya.demo@lozzi.example`       | `Synthetic-Only-2026!` | Blocking academic-hold denial                    |
| Jordan Lee     | Registrar  | `jordan.registrar@lozzi.example` | `Synthetic-Only-2026!` | Institution-scoped academic administration       |
| Elena Martinez | Instructor | `elena.instructor@lozzi.example` | `Synthetic-Only-2026!` | Assigned-section roster and grade lifecycle      |
| James Wilson   | Instructor | `james.instructor@lozzi.example` | `Synthetic-Only-2026!` | Unrelated-roster authorization denial            |
| Casey Nguyen   | Advisor    | `casey.advisor@lozzi.example`    | `Synthetic-Only-2026!` | Assigned-student access                          |

## Suggested demo order

1. Sign in as Aisha to show the student dashboard, current schedule, and
   registration eligibility grounded in a completed prerequisite.
2. Sign in as Priya to demonstrate that a blocking hold returns a clear,
   deterministic denial.
3. Sign in as Jordan to show institution-scoped oversight and the audit trail.
4. Use Elena and James when demonstrating assigned versus unrelated roster access.
5. Use Casey for assigned-advisor access.

## Reset

Run `pnpm exec supabase db reset` for the local test environment. This recreates
the accounts and all synthetic fixtures from `supabase/seed.sql`.

The public README intentionally lists only Aisha's restricted student login. This
file is the complete operator and test matrix.
