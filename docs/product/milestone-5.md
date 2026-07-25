# Milestone 5: partner integrations

## Outcome

Milestone 5 adds production-grade partner boundaries for World ID, ENS, 0G
Storage, and 0G Compute without making the core SIS depend on any partner.
Supabase Auth remains login and recovery. PostgreSQL remains the operational
source of truth. Partner calls enrich identity, naming, private storage, and
advisory explanations only.

## Current protocol decisions

### World ID 4.0

- Use the current IDKit 4.x request flow.
- Generate the relying-party signature on the server with the RP signing key.
- Bind the action to the authenticated Lozzi user through a non-public signal.
- Forward the completed IDKit payload unchanged to
  `POST https://developer.world.org/api/v4/verify/{rp_id}`.
- Persist the verified action, credential type, verification timestamp, and a
  normalized numeric nullifier with a uniqueness constraint.
- Never store the proof, raw World credential, signing key, or personal
  identity data.
- World verification never grants a Lozzi role or replaces Supabase Auth.

### ENS

- Resolve an existing name for a linked wallet through a server-side Viem
  adapter.
- Normalize every candidate name before lookup and fail closed on invalid
  names.
- Keep subname issuance behind the existing Ethereum Sepolia adapter decision.
- Persist only a public name, name hash, network, lifecycle status, and
  resolution timestamp.
- Do not write grades, GPA, record contents, file locations, or identity data
  into ENS text records.

### 0G Storage

- Encrypt every object before upload with a fresh AES-256-GCM object key.
- Bind the object type and owner context as authenticated additional data.
- Store ciphertext integrity metadata, the 0G root hash, encryption mode, and a
  wrapping-key reference; never store plaintext keys in PostgreSQL.
- Use the server-only 0G Storage adapter and proof-verified download path.
- Keep ECIES available only for a future wallet-recipient package.

### 0G Compute

- Use the server-oriented 0G Compute Router, not the Direct SDK in browser code.
- Send only the minimum deterministic degree-audit context needed to explain
  progress.
- Validate the response against the Lozzi progress-explanation schema before
  display or persistence.
- Persist provider/model metadata, request and response commitments, validation
  status, review state, timestamps, and error category—not plaintext prompts.
- The explanation is advisory. It cannot calculate the official GPA, alter
  requirements, award credit, or make an institutional decision.

## Capability states

Every provider reports exactly one state:

- `available`: required configuration is present and the adapter can be used.
- `mock-development`: a development-only deterministic adapter is active and
  visibly labeled.
- `not-configured`: required credentials or endpoints are absent.
- `failed`: configuration exists but the last bounded health or provider call
  failed.

Mocks are rejected in production. A failed partner never blocks authentication,
registration, grades, record publication, or deterministic progress.

## Product surfaces

- Student Settings shows World verification and ENS identity with direct,
  honest capability language.
- Student Progress offers an optional 0G explanation beside the deterministic
  degree audit and clearly labels advisory output.
- Registrar Settings shows institution-scoped provider configuration and last
  checked state without exposing secret values.
- Existing role navigation and the navy/teal/gold design system remain
  authoritative; Milestone 5 does not invent a separate partner dashboard.

## Data and security acceptance

- Partner mutations authenticate a Supabase cookie session and verify
  same-origin requests.
- World proof verification is replay-safe and scoped to the authenticated
  student.
- ENS resolution cannot be used to enumerate students or grant authorization.
- Encryption uses unique nonces and object keys; keys, plaintext, and private
  prompts never enter PostgreSQL, logs, URLs, or Git.
- 0G responses failing schema validation are rejected and recorded as failed.
- All partner writes use idempotency boundaries and append PII-free audit rows.
- New exposed objects have explicit Data API grants and RLS policies.
- Students can read only their own integration records; registrars remain
  institution-scoped; anonymous users receive no table access.

## Live execution gates

The production adapters are exercised live only when all required external
configuration exists:

- World: app ID, RP ID, RP signing key, action, and an allowed return origin.
- ENS: Ethereum Sepolia RPC, parent name, adapter/registrar address, and an
  authorized signer for issuance.
- 0G Storage: current 0G RPC/indexer endpoints, funded storage signer, and
  wrapping-key provider.
- 0G Compute: Router base URL, funded Router API key, and selected model.

Until those values exist, the corresponding acceptance result is
`not-configured`; no mock or fixture is reported as a live partner call.

## Excluded

- Contract deployment, World Chain anchoring, outbox processing, time-limited
  record sharing, public verification, and grant revocation remain Milestone 6.
- WalletConnect and wallet authorization remain configuration-only unless
  required for a separately approved ENS issuance demonstration.
- Real student information, production key recovery, and automatic AI academic
  decisions remain prohibited.
