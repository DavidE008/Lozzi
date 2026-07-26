# Milestone 7 deployment and submission readiness

Status: evidence prepared; deployment and submission are blocked.

Milestone 7 turns the repository, hosting, hosted database, partner, contract,
and submission state into one fail-closed record. It does not add a deployment
command, wallet client, private key, Safe proposal, raw transaction, hosted
mutation, World submission, ENS issuance, or event submission.

The machine-readable snapshot is
`deployment/milestone-7/submission-status.json`. Its schema is
`submission-status.schema.json`.

## Commands

```text
pnpm submission:status
pnpm submission:check
```

`submission:status` enforces the checked-in JSON schema at runtime and derives
whether each gate may pass from its typed evidence. Manual `status` labels
cannot override failed CI, unresolved dependencies, stale hosted migrations,
missing World/ENS configuration, invalid addresses, or an incomplete event
target.

It also validates local evidence paths, requires a clean tracked and untracked
worktree, rejects secret-like keys and values, and binds the snapshot to a
reviewed commit. Only the status snapshot itself may change after that commit,
and live evidence expires after 24 hours. It performs no external call and
exits zero when the evidence is current and structurally honest, even when
required gates are blocked.

`submission:check` runs the same validation with `--require-ready`. It exits
non-zero until every required gate passes. A non-zero result is currently
expected and must not be bypassed for submission.

`readyForDeployment` is narrower than event submission but still requires
passed repository, local-verification, dependency-security, and registry
deployment gates. Registry object fields alone cannot make it true.

Both commands reject deployment, signing, sending, submission, broadcast,
funding, and provisioning arguments.

## Deployment lanes

No blanket "deploy everything" approval is accepted. Each lane needs its own
review, change window, evidence, and recovery owner.

### Lane 1: hosted database

Current state: the hosted Lozzi Supabase project is healthy in `eu-west-2`,
contains only the known synthetic account/student markers, and is ten
migrations behind the repository.

Before mutation:

- review all ten pending migrations against a disposable branch or clean local
  reset;
- capture a backup and restore plan;
- define the hosted change window and operator;
- approve the exact migration range;
- apply once, then rerun migration history, pgTAP-equivalent smoke checks,
  security advisors, and synthetic access checks.

This lane does not authorize a frontend deployment.

### Lane 2: frontend hosting

Current state: the connected Vercel team API reports no projects and the GitHub
repository has no homepage URL. Git integration attempted an automatic preview
for PR #11, but Vercel reported `Deployment has been deleted` and the check
ended `ERROR`; there is no live preview or production deployment.

Before creation:

- approve Vercel or another exact provider, project owner, region, domain, and
  production branch;
- approve the public and server-only environment-variable inventory without
  copying values into an evidence packet;
- decide whether the first deployment is a private preview or production;
- bind the deployment to an exact Git commit;
- define rollback to the last known-good deployment;
- run desktop/mobile browser QA against the deployed URL before promotion.

This lane does not authorize World, ENS, registry, or Supabase changes.

### Lane 3: World runtime and app review

Current state: the managed RP is registered in production and staging and six
action records exist. The signing key is unavailable locally. App metadata is
unverified and lacks a website, overview, countries, logo, and showcase.

Runtime enablement, signing-key rotation, metadata edits, image uploads, and
app review submission are separate actions. Each requires explicit approval.
The production-device, entitlement, privacy, and no-proof-persistence checks
must be recorded before a live claim.

### Lane 4: registry contracts

Current state: contracts and offline preparation artifacts exist, but the
chain, Safe, deployer, relayer, funding, unsigned fork simulation, and
independent review are unresolved. The repository template must continue to
fail `pnpm deployment:preflight`.

The complete gate remains
`docs/deployment/milestone-6-approval-runbook.md`. Deployment requires:

- exact chain and chain ID;
- exact two-contract bytecode and constructor arguments;
- Safe owners, threshold, recovery, and role separation;
- deployer and relayer custody;
- gas, fee, and funding ceilings based on current network data;
- unsigned fork simulation of the complete ordered batch;
- Slither and independent manual review;
- transaction-specific, expiring approval;
- source verification and primary/independent RPC readback;
- an approved recovery path for immutable finalized transactions.

### Lane 5: ENS

Current state: no parent, Safe, registrar, signer, approval, deployment, or
canary exists.

Parent registration or delegation, Safe creation, registrar deployment,
approval, signer funding, subname issuance, and resolution verification are
separate onchain actions. Follow
`docs/integrations/ens-operator-runbook.md`; do not infer approval from a
passing local registrar suite.

### Lane 6: event submission

Current state: the event, portal, deadline, required fields, prize tracks, demo
URL, and video requirements are unresolved.

Submission is allowed only after the exact target is recorded and the public
materials are checked against its current rules. The submission copy must
distinguish implemented code, local demo behavior, blocked live behavior, and
future approval-gated work.

## Current outcome

`pnpm submission:status` reports two passed gates and eight blocked gates.
`readyForDeployment` and `readyForSubmission` are both `false`.

No manual or production deployment, provisioning, signing, funding, Safe
action, hosted mutation, World review submission, ENS issuance, event
submission, or onchain transaction was performed to create this record. The
deleted automatic PR preview attempt is recorded above rather than represented
as a live deployment.
