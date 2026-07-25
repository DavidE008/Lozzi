# Milestone 2 — Academic structure and authorization

## Outcome

Milestone 2 gives Northstar University registrars a secure operating workspace
for maintaining the institution's academic structure. Every read and write is
scoped by active database membership and role assignment; browser-visible
metadata never grants authorization.

## Included

- Role-aware routing for students, registrars, and institution administrators.
- A registrar workspace based on the approved production concept.
- Institution, membership, staff-role, department, term, program,
  program-version, requirement, course, prerequisite, section, instructor, and
  meeting management.
- Server-side repositories and validated Server Actions.
- Append-only, PII-minimized audit events for academic-structure mutations.
- RLS, explicit Data API grants, authorization helpers, and permission tests.
- Desktop and mobile browser coverage for the registrar workflow.

## Explicit non-goals

- Registration eligibility, enrollment, withdrawal, and seat concurrency are
  Milestone 3.
- Grade submission, publication, correction, and record versioning workflows
  are Milestone 4.
- Live World, ENS, 0G, WalletConnect, or onchain operations remain
  unconfigured.
- No destructive deletion of institution-owned academic history.
- No real student data.

## Delivery gates

| Gate | Deliverable            | Exit evidence                                                        |
| ---- | ---------------------- | -------------------------------------------------------------------- |
| M2.1 | Authorization boundary | Write policies, role matrix, explicit grants, pgTAP denial tests     |
| M2.2 | Domain foundation      | Zod commands, repository interfaces, mapping and authorization tests |
| M2.3 | Registrar overview     | Approved shell and dashboard populated from PostgreSQL               |
| M2.4 | Management workflows   | Validated create/update/deactivate flows for each academic area      |
| M2.5 | Acceptance             | Desktop/mobile browser QA, design comparison, advisors, green PR     |

## Commit discipline

Work is split by independently reviewable concern: scope/design contract,
database authorization, domain commands, role-aware routing, registrar shell,
catalog, terms, sections, institution/team management, tests, and acceptance
evidence. Each commit must leave relevant checks passing and avoid unrelated
formatting churn.
