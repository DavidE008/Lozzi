# Submission checklist

Snapshot: 2026-07-26. Overall status: **not ready to deploy or submit**.

The source of truth is
`deployment/milestone-7/submission-status.json`. Run
`pnpm submission:status` for the current bounded report and
`pnpm submission:check` for the strict readiness gate. The strict command is
expected to fail while any required gate below is blocked.

## Gate status

| Gate                    | Status  | Verified evidence                                                                | Remaining blocker                                                                        |
| ----------------------- | ------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Public repository       | Passed  | Public `DavidE008/Lozzi`, MIT, issues enabled, `main` Quality passed             | None                                                                                     |
| Local verification      | Passed  | 55 domain, 173 web, 12 script, 29 Forge, 413 pgTAP, 17 Playwright, 3 concurrency | Final M7 full rerun and hosted PR CI still pending                                       |
| Dependency security     | Blocked | Configured high threshold passes; no high or critical advisories                 | Two moderate optional/transitive advisories need reachability and upgrade disposition    |
| Hosted Supabase         | Blocked | Healthy `eu-west-2`; 7 users and 3 students match synthetic markers              | Hosted history has 30 of 40 migrations; no hosted mutation is authorized                 |
| Frontend deployment     | Blocked | Connected Vercel account checked read-only                                       | No project, deployed commit, public demo URL, domain, or rollback evidence               |
| World runtime           | Blocked | Managed production/staging RP registered; six action records                     | Signing key, entitlement, production-device journey, and anonymized feedback absent      |
| World app review        | Blocked | External app exists and is active                                                | Website, overview, countries, logo, showcase, and explicit review approval absent        |
| ENS                     | Blocked | Local adapter, lifecycle, and registrar tests                                    | No parent, Safe, registrar, signer, approval, deployment, issuance, or canary            |
| Academic registries     | Blocked | Contracts, fingerprints, schemas, offline preflight, Slither 0.11.5              | Chain, Safe, relayer, funding, fork simulation, finding acceptance, independent approval |
| Event submission target | Blocked | Repository searched; no exact target recorded                                    | Event, portal, deadline, required fields, prize tracks, demo media, and submit approval  |

## Implemented and verified code

- Unified World to wallet to ENS identity setup with World verification required
  before wallet linking or ENS issuance.
- Student consent before a generated institutional ENS alias can be issued.
- Academic records stay private and offchain; public state is limited to
  opaque commitments and lifecycle evidence.
- Durable outbox production, claiming, retry, reconciliation, and dead-letter
  handling.
- Record-version anchoring, time-limited sharing, public verification,
  revocation, and expiration behavior.
- Fail-closed registry simulation, receipt inspection, independent readback,
  and offline deployment preparation.
- No 0G work is included in the active submission scope. Existing 0G code and
  documentation remain preserved.

## Local and demo behavior

- Synthetic student, staff, record, sharing, and public-verifier journeys run
  locally.
- Local World demo state is explicitly labeled and cannot unlock a wallet or
  ENS issuance.
- Missing provider and onchain configuration produces unavailable or
  disabled states, never a live success claim.
- Offline deployment artifacts contain no signer and cannot broadcast.

## Blocked live World behavior

- App: `app_406624a7ab8b70f37f662453518dda71`.
- RP: `rp_27a81819333b3230`.
- Production and staging registration are initialized.
- Six actions exist: three expected action names in both environments.
- The RP signing key is unavailable locally and was not retrieved or rotated.
- Selfie/Identity entitlement and production-device evidence are absent.
- World app review metadata and public media are incomplete.

## Blocked live ENS behavior

- No approved Ethereum Sepolia parent exists for Lozzi.
- No independently owned 2-of-3 Safe is selected.
- No registrar is deployed or approved by a parent.
- No managed issuance signer or funding policy exists.
- No synthetic subname has been issued.
- No independent forward/reverse resolution canary exists.

## Hosted database status

The hosted project is healthy and the bounded synthetic-marker query found:

- 7 auth users, 0 outside the `@lozzi.example` plus `synthetic: true`
  convention;
- 3 students, 0 outside the synthetic pseudonymous-ID convention.

This check does not prove the absence of every possible sensitive value in
every table. It is a bounded submission check and did not export record
content.

Hosted migration history contains 30 migrations. The repository contains 40.
The ten pending migrations include World challenge/share state, AgentKit, ENS,
and all Milestone 6 outbox, verifier, revocation, expiration, and hardening
changes. Applying them is a hosted mutation and needs a separate explicit
approval, backup/restore plan, exact migration range, and post-change checks.

Hosted advisors currently report:

- 9 `authenticated_security_definer_function_executable` warnings that require
  documented authorization dispositions against the intended RPC surface;
- leaked-password protection disabled;
- informational unused-index findings expected on a fresh synthetic project,
  to be reassessed with representative workload.

These findings do not change local test results, but they block a production
readiness claim.

## Dependency audit status

`pnpm audit:dependencies` passes the configured `high` threshold. The full
production audit still reports two moderate transitive advisories:

- `bn.js` through optional WalletConnect dependencies:
  `GHSA-378v-28hj-76wf`;
- `uuid` through optional MetaMask/wallet dependencies:
  `GHSA-w5hq-g745-h8pq`.

Both enter through `@x402/hono` to `@x402/paywall` optional wallet trees. Before
production deployment, record whether those paths are bundled or reachable in
Lozzi, then upgrade the owning package or apply a tested package-manager
override. Do not weaken the audit threshold or claim the full audit is clean.

## Solidity static-analysis status

Slither 0.11.5 completed against the four first-party contracts with
dependencies and tests excluded by the checked-in configuration. It reported
18 findings: zero high, seven medium, and eleven low.

The local triage is recorded in
`docs/security/milestone-7-slither-review.md`. It does not replace the
independent pre-deployment review. Deployment remains blocked until an
independent reviewer accepts each disposition or an approved fix is tested and
the bytecode fingerprints, manifest, simulation, and transaction packet are
repinned.

## Actions requiring future explicit approval

Approvals are lane-specific and may not be bundled by implication:

1. Apply an exact hosted Supabase migration range.
2. Create a named hosting project or promote a reviewed deployment.
3. Set production environment values through approved secret storage.
4. Rotate or replace the unavailable World RP signing key.
5. Edit World metadata, upload public media, or submit the World app for review.
6. Select the exact registry chain and approve Safe/deployer/relayer custody.
7. Fund a deployment or relayer within exact gas and value ceilings.
8. Submit an exact Safe action or onchain transaction.
9. Register or delegate an ENS parent, deploy a registrar, set approvals, or
   issue a subname.
10. Submit Lozzi to a named event and selected prize tracks.

Every onchain approval must identify target chain, contract/address, decoded
action, value, calldata hash, gas/fee ceiling, signer/governance path,
simulation block, expiry, readback, and recovery owner.

## Submission package still required

- Exact event name, portal URL, deadline, timezone, team members, and eligibility.
- Public demo URL bound to a reviewed Git commit.
- Event-compliant demo video and screenshots with no private World screen,
  student data, proof, key, token, or secret.
- Final project title, concise summary, problem, technical explanation, and
  selected prize tracks.
- World/ENS claims matched to real live evidence or explicitly labeled as
  local/prepared.
- Final independent QA on the deployed URL.
- Final strict `pnpm submission:check` pass.
- Explicit human approval to submit.

## Explicitly not performed

- No deployment.
- No World or ENS provisioning.
- No signer retrieval or rotation.
- No Safe action.
- No ENS subname issuance.
- No ownership or approval change.
- No hosted Supabase mutation.
- No wallet funding.
- No onchain transaction.
- No World app review or event submission.
