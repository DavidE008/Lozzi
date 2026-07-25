# Milestone 5 verification

## Implemented

- World ID 4.x RP requests are signed on the server and bound to the signed-in
  Supabase user. Exact completed proof payloads are verified server-side; only
  normalized credential evidence is persisted.
- Ethereum Sepolia ENS names are normalized, issued through the selected
  institutional adapter, gas-capped, confirmed, and resolved back to the
  student's verified wallet.
- Private 0G objects use fresh per-object AES-256-GCM keys. Object keys are
  wrapped with a separate server-only key; ciphertext is uploaded, proof
  downloaded, byte-compared, and then recorded.
- The optional student progress explanation sends a minimized deterministic
  audit through the server-oriented 0G Router. Input and validated output are
  separately encrypted and stored; PostgreSQL receives commitments and
  evidence, not plaintext.
- `available`, `mock-development`, `not-configured`, and `failed` states are
  typed. Mocks are development-only and visibly disclose that no partner call
  occurred.

## Automated results

Run from repository root:

```text
pnpm lint             passed
pnpm typecheck         passed
pnpm test              28 domain + 50 web tests passed
pnpm build             passed, including all four partner API routes
pnpm audit:dependencies passed, no known vulnerabilities
```

The GitHub Actions database job resets the complete migration chain and runs
pgTAP in a clean container. Contract and secret-scanning jobs remain required
even though Milestone 5 does not deploy or modify a live contract.

## Privacy and failure evidence

- Encryption tests prove fresh ciphertext for identical plaintext, successful
  unwrap/decrypt, and failure with the wrong wrapping key.
- Storage tests reject ciphertext/commitment mismatches and provider root
  mismatches.
- World tests reject a proof bound to another user and database tests reject a
  replayed nullifier.
- ENS tests reject unsafe labels, gas above the configured cap, and a confirmed
  name that resolves to the wrong wallet.
- 0G Compute tests reject malformed and schema-invalid output.
- Workflow tests prove only encrypted bytes reach storage and that a
  rate-limited run records failure without fabricating output.
- Capability tests prove development mocks are unavailable in production.

## Live acceptance state

The two Milestone 5 migrations were applied to hosted project
`mmyndcqtovqxyoucrfdb` as:

- `20260725144658_milestone_5_integration_lifecycle`
- `20260725144705_partner_service_transactions`

Hosted checks confirm RLS is enabled on World, ENS, student-wallet, 0G object,
AI run, and capability tables. The six trusted partner functions pin an empty
`search_path`, deny execution to `anon` and `authenticated`, and grant execution
only to `service_role`. The student partner-summary view uses
`security_invoker`, denies anonymous reads, and is available to authenticated
users subject to underlying RLS.

World, ENS, 0G object, and AI run row counts remain zero. This is expected: the
hosted environment does not contain live partner credentials, so no fixture is
represented as provider evidence.

The hosted environment does not contain World, ENS, 0G, WalletConnect, or
World Chain signing/deployment credentials. Those capabilities must therefore
render **Not configured** and no live partner success is claimed.

Required for a live Milestone 5 demonstration:

| Capability     | Required server-side configuration                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| World          | `NEXT_PUBLIC_WORLD_APP_ID`, `WORLD_RP_ID`, `WORLD_RP_SIGNING_KEY`, `WORLD_ID_ENVIRONMENT`                  |
| ENS            | `NEXT_PUBLIC_ENS_PARENT`, `ENS_SEPOLIA_RPC_URL`, `ENS_REGISTRAR_ADDRESS`, `ENS_SIGNER_PRIVATE_KEY`         |
| 0G Storage     | `ZERO_G_RPC_URL`, `ZERO_G_INDEXER_RPC_URL`, funded `ZERO_G_STORAGE_PRIVATE_KEY`, `KEY_WRAPPING_MASTER_KEY` |
| 0G Compute     | `ZERO_G_ROUTER_URL`, funded `ZERO_G_COMPUTE_API_KEY`, `ZERO_G_COMPUTE_MODEL`                               |
| Trusted writes | `SUPABASE_SERVICE_ROLE_KEY` in the server runtime only                                                     |

WalletConnect and World Chain Sepolia deployment remain Milestone 6.

## Environmental limitation

Docker is unavailable in the current Windows workspace, so local Supabase reset
and pgTAP execution are delegated to the required GitHub Actions container job.

Hosted advisors report no new Milestone 5 security finding. Existing warnings
identify the authenticated, authorization-checking registration and grade
functions from Milestones 3–4, plus project-level leaked-password protection;
those are unchanged by this milestone. Performance notices are informational
unused-index findings expected in the low-volume synthetic tenant. Foreign-key,
replay, lifecycle, and lookup indexes are retained for correctness and expected
production access paths.
