# Milestones 0–3 project plan

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

Milestones 0–1 were delivered through `codex/milestones-0-1`, and Milestone 2
through `codex/milestone-2`. Milestone 3 uses small, independently reviewable
commits on `codex/milestone-3`. A gate is complete only when its executable
checks pass; documentation never substitutes for a failing control.

Milestone 3 implementation is complete when the student registration workflow,
the registrar oversight view, and every local and hosted verification gate
pass. Final acceptance is recorded only after pull request 3 is green and
merged to `main`.
