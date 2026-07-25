# CROPS review

Chosen default: keep authentication, identity signals, academic records, audit
inputs, and AI output offchain under institution-scoped authorization. Optional
partner operations publish only public names, encrypted-object roots, and
future salted commitments. The core SIS remains usable when every partner is
not configured.

## Censorship resistance

- Risk: Supabase, the web host, World, the ENS RPC, 0G gateways, or an
  institutional signer can block an optional operation. The institution also
  controls academic administration by design.
- Mitigation: the MIT-licensed schema, adapters, migrations, encryption format,
  and provider interfaces are reproducible. Partner failures are isolated from
  login, registration, grades, records, and deterministic progress.
- User escape: another operator can fork and self-host Lozzi. Public ENS names,
  0G roots, and later registry reads remain independently queryable through
  alternative clients.

## Open and free

- Risk: hosted APIs, funded testnet accounts, and provider billing can make
  nominally open paths unavailable.
- Mitigation: no proprietary client is required for the core SIS. Provider
  adapters are explicit, development mocks are visibly labeled, and live state
  requires provider evidence.
- User escape: disable or replace a provider adapter without changing the
  domain model. No partner capability grants a Lozzi role.

## Privacy

- Risk: World observes proof traffic and network metadata; ENS publishes a
  name-to-wallet relationship; 0G exposes transactions, roots, sizes, and
  timing; the Router necessarily processes the minimized audit context.
- Mitigation: World is bound to a non-public authenticated-user signal and the
  proof is never stored. ENS receives no text records. Every 0G object is
  encrypted with a fresh AES-256-GCM object key before upload, and PostgreSQL
  receives only commitments, references, and lifecycle evidence. No analytics
  run. Logs contain categories rather than student data.
- User escape: World, ENS, and 0G are opt-in and unnecessary for authoritative
  SIS reads. A student can rely on the deterministic audit without requesting
  an AI explanation.

## Security

- Risk: service-role credentials, World RP keys, the ENS signer, the funded 0G
  storage signer, Router credentials, and wrapping keys are high-value
  capabilities. A compromised server could submit unwanted partner operations.
- Mitigation: keys remain server-only; RLS derives authority from memberships;
  mutations are authenticated and same-origin; partner payloads are
  schema-validated; ENS gas is capped; uploads are proof-downloaded and compared;
  calls expose pending and failure states; database writes are idempotent and
  PII-free.
- User escape: revoke or rotate an individual provider credential without
  disabling the core SIS. Production key wrapping must use a recoverable KMS
  policy; loss of the wrapping key makes encrypted objects unrecoverable.

## Accepted compromises

Lozzi is a hosted institutional system, not a hyperstructure. Its authoritative
academic workflows remain censorable by the institution and host. Milestone 5
does not deploy a contract or claim that encrypted storage hides public
transaction metadata. A live partner result is accepted only after the intended
provider returns verifiable evidence; otherwise the product says **Not
configured**, **Development mock**, or **Unavailable**.
