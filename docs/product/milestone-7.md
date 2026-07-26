# Milestone 7: deployment and submission readiness

Milestone 7 prepares Lozzi for a reviewable deployment and event submission
without treating preparation as authority to mutate a hosted or onchain
environment.

## Goals

- Produce one machine-readable status for repository, hosting, hosted database,
  World, ENS, registry, verification, and event-submission gates.
- Make stale or contradictory live claims fail validation.
- Keep deployment lanes independently approvable and recoverable.
- Provide current judge-facing evidence that distinguishes implemented code,
  local behavior, blocked live behavior, and future explicit approvals.
- Publish a pull request only after independent QA and all repository checks
  pass.

## Current status

Implemented and verified:

- The public repository is MIT-licensed, issues are enabled, and `main` CI is
  green.
- Milestone 6 application, database, contract, outbox, sharing, verifier,
  revocation, and expiration behavior is locally verified.
- World RP registration and six action records are confirmed read-only.
- The hosted Supabase project is healthy and the known users/students match
  synthetic markers.

Local or demo only:

- World local-demo state is visibly labeled and cannot unlock wallet linking
  or ENS issuance.
- Contract, ENS, worker, and registry paths remain disabled without complete
  live configuration.
- Offline deployment manifests and simulation schemas are evidence formats,
  not executable authorization.

Blocked live World behavior:

- The RP signing key is not locally available.
- Entitlement and production-device evidence is absent.
- Website, overview, countries, logo, showcase, and app review are incomplete.

Blocked live ENS behavior:

- No parent, Safe, registrar, signer, approval, deployment, or consenting
  synthetic canary exists.

Blocked deployment and submission behavior:

- Two moderate optional/transitive dependency advisories need a documented
  reachability and upgrade or override disposition.
- Hosted Supabase is ten migrations behind.
- Vercel's automatic PR preview is `READY` but returns HTTP 500; no working
  public demo or production deployment exists.
- The registry chain, Safe, funding, simulation, and independent review are
  unresolved.
- Slither reports zero high, seven medium, and eleven low findings. The
  findings are locally triaged but still require independent acceptance or a
  reviewed fix and deployment-evidence repin.
- The target event, portal, deadline, required fields, prize tracks, and media
  requirements are not recorded.

## Exit gate

Run:

```text
pnpm submission:status
pnpm submission:check
```

The first command must validate the truthfulness of the record. The second must
remain non-zero until every required live and submission gate actually passes.
No blocked gate may be relabeled to make the command green.
