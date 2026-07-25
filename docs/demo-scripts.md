# Demo scripts

## Student path

1. Sign in as `aisha.demo@lozzi.example`.
2. Confirm the dashboard names Aisha Rahman and Northstar University.
3. Confirm GPA 4.00, 3/120 credits, 3% progress, and CS 2305 enrollment.
4. Open Record, Progress, Shares, and Settings from the primary navigation.
5. Sign out and confirm `/student` is protected.

## Privacy and capability path

1. Open Settings and show World, ENS, 0G, WalletConnect, and World Chain as
   “Not configured”.
2. Explain that the SIS remains available without those partners.
3. Show that demo data is synthetic and that no wallet is linked to Aisha.

## Verifiability path

1. Run domain commitment fixtures in TypeScript.
2. Run Foundry tests for institution authorization, record linkage,
   idempotency, grants, expiration, revocation, and sensitive-string absence.
3. State explicitly that no contract has been deployed.

## World sensitive-share path

1. Open **Shares** as Aisha and create a synthetic 30-minute protected share.
2. Show that Identity Check requests only `minimum_age: 18`.
3. Complete adult self-consent, then complete the draft-bound Selfie Check.
4. Copy the one-time share token and show that only its hash is persisted.
5. Repeat with the adult check unavailable and show the non-revealing
   registrar-assisted state.

Do not capture World private screens, faces, identity documents, proof bodies,
or attribute values.

## Human-backed degree-plan agent path

1. Confirm the dedicated address and canonical AgentBook registration through
   an independent World Chain mainnet read.
2. Open Aisha’s **Degree progress** page and create the 30-minute, one-use
   delegation.
3. Run `pnpm --filter @lozzi/web agentkit:demo` and paste the token only into
   the hidden prompt.
4. Show the minimized course-code context and pending proposal response.
5. Sign in as Casey Nguyen and review the proposal at `/advisor`.
6. Confirm that no enrollment or official academic record changed.
