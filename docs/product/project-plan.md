# Milestones 0–7 project plan

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
| M5.1 | Partner trust boundaries    | Current docs, typed adapters, server-only secret boundaries  |
| M5.2 | World verification          | RP-signed requests, server proof verification, replay denial |
| M5.3 | ENS identity                | Resolution, normalized names, Sepolia subname adapter state  |
| M5.4 | Private 0G storage          | Envelope encryption, ciphertext upload, integrity metadata   |
| M5.5 | Private 0G inference        | Deterministic input, validated explanation, committed output |
| M5.6 | Integration operations      | Capability health, PII-free audits, visible failure states   |
| M5.7 | Acceptance                  | Provider tests, hosted policies, browser QA, and green PR    |
| M6.1 | Anchoring domain            | Versioned commitments, grant lifecycle, public reads         |
| M6.2 | Transactional outbox        | Atomic producers, leases, retry, reconciliation, dead letter |
| M6.3 | Registry adapter            | Two-RPC validation, simulation, receipt and state readback   |
| M6.4 | Sharing and verifier        | Minimum disclosure, expiry, revocation, rate limits          |
| M6.5 | Deployment preparation      | Fingerprints, unsigned packet, governance, recovery gates    |
| M6.6 | Acceptance                  | Full tests, concurrency, browser QA, green product/prep PRs  |
| M7.1 | Readiness inventory         | GitHub, hosting, database, World, ENS, registry evidence     |
| M7.2 | Executable status           | Honest status passes; strict check blocks incomplete claims  |
| M7.3 | CROPS and deployment lanes  | Host, DB, World, registry, ENS, and submission boundaries    |
| M7.4 | Submission package          | Target, demo URL, video, screenshots, claims, prize mapping  |
| M7.5 | Acceptance                  | Independent QA, full gates, hosted CI, explicit submit gate  |

Milestones 0–1 were delivered through `codex/milestones-0-1`, Milestone 2
through `codex/milestone-2`, Milestone 3 through `codex/milestone-3`, and
Milestone 4 through `codex/milestone-4`. Milestone 5 was delivered through
`codex/milestone-5` and `codex/world-real-config`. Milestone 6 was delivered in
three reviewable stops: foundation, product, and deployment preparation.
Milestone 7 uses `codex/milestone-7-submission-readiness`.

A gate is complete only when its executable checks and required live evidence
pass; documentation never substitutes for a failing control. A provider is
counted as live only after an authenticated call succeeds against the intended
environment and the required readback is recorded. Missing credentials,
infrastructure, approvals, hosted migrations, media, or event metadata remain
blockers, never production or submission success claims.
