# World prize evidence

This document maps Lozzi’s Start-from-Scratch World integrations to
implementation and evidence. Continuity-only categories are not claimed. No
manual journey is marked complete until the real provider returns verifiable
evidence.

## Qualification map

| Integration                       | Prize-facing behavior                                                              | Implementation evidence                                                                                          | Manual evidence status            |
| --------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| AgentKit degree-planning agent    | A registered human-backed agent receives three free uses per human and endpoint    | Hono/x402 route, canonical `eip155:480` AgentBook lookup, Supabase nonce/usage storage, encrypted demo-agent EOA | Registration and live run pending |
| Sensitive-share Selfie Check      | A verifier-confirmed Selfie Check is required for a specific 30-minute share draft | Purpose-bound `selfieCheckLegacy`, authenticated-student and draft signal, one-time challenge, atomic activation | Sandbox and production QA pending |
| Adult self-consent Identity Check | The student attests only that the minimum-age requirement is met                   | World ID 4 `identityCheck([{ type: "minimum_age", value: 18 }])` and server-side `identity_attested === true`    | Production credential QA pending  |

## Privacy and authorization evidence

- Supabase Auth remains login and recovery. World never grants a Lozzi role.
- World proof JSON, integrity bundles, face data, identity documents, dates of
  birth, nationality, names, document numbers, and attested attribute values
  are neither persisted nor logged.
- Account humanity preserves global action/nullifier uniqueness. Later
  purpose-specific checks may be repeated for distinct share drafts but only
  once per challenge and purpose/draft pair.
- Adult-check failure and beta unavailability share one registrar-assisted
  path, so the UI does not reveal whether an age condition failed.
- The agent sees only course requirements, completion flags, and eligible
  course codes. It never receives names, emails, grades, GPA, or raw records.
- The agent cannot enroll a student or mutate any official record. Every
  proposal remains pending until an assigned advisor reviews it.
- Raw AgentKit human IDs, agent addresses, delegation tokens, and nonces are
  replaced with domain-separated HMAC commitments or hashes before database
  writes.

## Automated evidence

Run:

```bash
pnpm --filter @lozzi/domain test
pnpm --filter @lozzi/web test
pnpm typecheck
pnpm lint
supabase test db
```

Coverage includes purpose mapping, exact proof-body forwarding, signal and
challenge binding, Identity Check presence, replay/expiry rejection, AgentKit
EIP-191 signing, full resource-path and World Chain binding, canonical
AgentBook registered/unregistered results, atomic three-use limits,
single-use delegation scopes, minimized context, immutable proposals,
assigned-advisor access, unrelated-user denial, and official-record mutation
denial.

## Manual evidence checklist

- [ ] Staging Proof of Human succeeds through the simulator.
- [ ] Selfie Sandbox access is enabled and both hot and cold journeys are
      recorded without face/private-screen captures.
- [ ] Production Selfie Check succeeds in World App.
- [ ] Production minimum-age attestation succeeds with a consenting,
      document-backed adult credential.
- [ ] PostgreSQL inspection confirms no proof bodies or identity attribute
      values.
- [ ] Structured log inspection confirms no proof, token, human ID, agent
      address, or student PII.
- [ ] The dedicated agent address is registered through the approved QR.
- [ ] A direct configurable World Chain RPC read confirms AgentBook
      registration and the relay transaction hash.
- [ ] The local agent reads the minimized context, submits a pending proposal,
      and Casey Nguyen records an advisor decision.

## Tester feedback

Recruit at least three consenting testers when Selfie and Identity beta access
is enabled. Record only:

- anonymized tester code;
- flow and environment;
- completion outcome;
- clarity, confidence, and friction notes;
- whether privacy copy was understood.

Do not record faces, biometric outcomes, identity documents, document-backed
attributes, World nullifiers, private World screens, names, email addresses, or
wallet addresses.

Current feedback status: no consenting live testers have completed these
provider journeys yet, so no feedback is claimed.

## Developer feedback

- The SDK’s standard validation checks the URI host but not the complete path.
  Lozzi therefore adds an exact pathname, query, fragment, and signed-resource
  check before a delegation or free-trial use can be consumed.
- AgentKit’s storage hooks receive nonce and human ID at different stages.
  Lozzi uses request-scoped server context and one database transaction so
  nonce replay, usage, agent commitment, human commitment, and delegation scope
  remain atomic.
- Selfie Check and Identity Check are beta-gated Portal capabilities. The app
  preserves honest unavailable states instead of substituting a weaker proof.
