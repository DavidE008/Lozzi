# Submission checklist

## Required evidence

- [ ] Public `DavidE008/lozzi` repository, MIT license, issues enabled.
- [ ] `main` contains a merged, green Milestones 0–1 PR.
- [ ] Hosted Lozzi Supabase project in `eu-west-2` with synthetic data only.
- [ ] Migration reset, pgTAP, advisors, and explicit-grant/RLS checks recorded.
- [ ] Frozen install, format, lint, strict typecheck, unit, build, Foundry,
      audit, and secret-scan gates pass.
- [ ] Desktop and mobile sign-in/dashboard/navigation/logout verified.
- [ ] Final dashboard screenshot compared with the approved concept across
      layout, copy, typography, color, spacing, icons, responsiveness, and
      state behavior.
- [x] World Developer Portal app/RP inventory verified, production and staging
      registrations confirmed, and all three actions created in both
      environments.
- [ ] World runtime signing key, entitlement checks, and production-device
      evidence approved and recorded.
- [ ] ENS parent/Safe/registrar deployment and one consenting synthetic canary
      independently verified.
- [ ] No contract deployment or live-partner claim.

## Still-required World + ENS inputs

- Explicit approval to rotate the unavailable signing key for
  `rp_27a81819333b3230`, with the replacement stored only in approved runtime
  secret storage.
- Confirmed Selfie Check and Identity Check beta access.
- A real Proof-of-Human credential, production-device evidence, and anonymized
  tester feedback.
- Approved Ethereum Sepolia ENS parent, 2-of-3 Safe ownership, verified adapter
  deployment, KMS-backed issuance address, independent read RPC, and renewal
  owner. Raw production private keys are not an acceptable prerequisite.

These inputs are deliberately absent from the repository and current
environment.

The combined journey, runtime boundaries, manual provisioning gates, and
remaining limitations are tracked in the
[World + ENS identity journey](integrations/world-ens-identity-journey.md).

## Paused partner inputs

0G Compute/Storage, WalletConnect, World AgentKit, and World Chain registry
inputs are not required for the current identity demo. Existing abstractions are
preserved, but no provisioning, funding, completion claim, or further
integration work is in scope.
