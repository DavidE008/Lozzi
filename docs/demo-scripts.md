# Demo scripts

## World + ENS identity path (3-4 minutes)

> Lozzi is a privacy-first student information system where World verifies the
> person and ENS gives that student a readable, institution-issued digital
> identity. Academic records remain private and offchain, while the student
> controls wallet linking, identity consent, and record sharing.

1. Sign in as the synthetic student and open **Identity & privacy**.
2. Show the four steps: verify person, verify wallet, review identity, and
   institution confirms.
3. Explain that World proves only the configured personhood claim. It does not
   prove enrollment, grades, legal identity, or institutional affiliation.
4. Complete the configured World flow, or run the clearly labeled local demo.
   In local mode, show that the result says **Local demo only** and wallet
   linking remains blocked with **Real proof required**.
5. In a real configured flow, show that SIWE proves wallet control without a
   transaction and without consenting to an ENS alias.
6. Generate the neutral alias and show the separate public-alias consent. Point
   out that no name, email, student number, course, or grade is encoded.
7. If live ENS is absent, stop at **Prepared locally** and state that no ENS
   name, wallet resolution, Safe action, or transaction exists.
8. Explain that a live request is durable and idempotent, the institutional Safe
   retains control, and Lozzi requires an independent resolution read before it
   calls an identity issued.
9. Close on the privacy summary: raw World proofs are not stored and the
   academic record remains private and offchain.

See the
[combined identity journey](integrations/world-ens-identity-journey.md) for the
timed narration, trust boundaries, and judge-facing technical explanation.

## Student path

1. Sign in as `aisha.demo@lozzi.example`.
2. Confirm the dashboard names Aisha Rahman and Northstar University.
3. Confirm GPA 4.00, 3/120 credits, 3% progress, and CS 2305 enrollment.
4. Open Record, Progress, Shares, and Settings from the primary navigation.
5. Sign out and confirm `/student` is protected.

## Privacy and capability path

1. Open **Identity & privacy** and show the unified World + ENS status.
2. Explain that the SIS remains available when either integration is absent.
3. Show that demo data is synthetic and that no mock result is presented as a
   live proof, wallet link, ENS name, or transaction.
4. Do not present 0G, WalletConnect, World AgentKit, or World Chain registry work
   as part of the current identity demo.

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
