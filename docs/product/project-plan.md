# Milestones 0–4 project plan

| Gate | Deliverable                 | Exit evidence                                                |
| ---- | --------------------------- | ------------------------------------------------------------ |
| M0.1 | Scope and trust model       | Scope, architecture, CROPS, and privacy records              |
| M0.2 | Product and visual contract | Approved concept archive and design spec                     |
| M0.3 | Partner decisions           | Five ADRs and capability-state policy                        |
| M1.1 | Engineering foundation      | Pinned monorepo, CI, lint, typecheck, tests                  |
| M1.2 | Data foundation             | Ordered migrations, seed, RLS/grant pgTAP tests              |
| M1.3 | Verifiability foundation    | Canonical commitment fixtures and registries                 |
| M1.4 | Student product             | Authenticated dashboard and read-only destinations           |
| M1.5 | Acceptance                  | Browser QA, screenshots, advisors, green PR                  |
| M2.1 | Authorization boundary      | Scoped write policies, grants, and permission tests          |
| M2.2 | Academic structure          | Validated institution, catalog, term, and section management |
| M2.3 | Registrar product           | Approved workspace and working management destinations       |
| M2.4 | Acceptance                  | Browser QA, design comparison, advisors, green PR            |
| M3.1 | Registration domain         | Deterministic eligibility decisions and unit tests           |
| M3.2 | Registration data boundary  | Atomic, idempotent registration and withdrawal RPCs          |
| M3.3 | Student registration        | Catalog, plan, submission, schedule, and honest states       |
| M3.4 | Registrar oversight         | Institution-scoped, read-only registration activity          |
| M3.5 | Acceptance                  | Concurrency, browser QA, design comparison, and green PR     |
| M4.1 | Grade authorization         | Assigned-section roster boundary and denial tests            |
| M4.2 | Grade lifecycle             | Draft, submit, approve, and publish transactions             |
| M4.3 | Record versioning           | Linked corrections, current pointers, and immutable history  |
| M4.4 | Progress calculation        | Deterministic GPA, earned credits, and degree-audit results  |
| M4.5 | Role products               | Instructor entry, registrar review, student record/progress  |
| M4.6 | Acceptance                  | Lifecycle tests, browser QA, design comparison, and green PR |

Milestones 0–1 were delivered through `codex/milestones-0-1`, and Milestone 2
through `codex/milestone-2`. Milestones 3 and 4 use small, independently
reviewable commits on `codex/milestone-3` and `codex/milestone-4`. A gate is
complete only when its executable checks pass; documentation never substitutes
for a failing control.

Milestone 4 implementation is complete when the grade lifecycle, record
correction history, deterministic progress calculations, role-specific product
surfaces, and every local and hosted verification gate pass. Final acceptance
is recorded only after the Milestone 4 pull request is green and merged to
`main`.
