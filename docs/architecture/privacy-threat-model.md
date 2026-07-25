# Privacy threat model

## Assets

Identity, enrollment, grades, GPA, holds, advisor relationships, shares,
object-encryption material, Supabase sessions, institutional signer keys, and
the mapping between a person and any onchain identifier.

## Adversaries

- Anonymous internet user enumerating the Data API.
- Authenticated student probing another student's UUID.
- Instructor or advisor exceeding an assignment.
- Compromised browser or dependency reading secrets.
- Operator or log sink collecting unnecessary PII.
- Onchain observer linking commitments through predictable payloads.
- Database reader attempting to decrypt stored objects.

## Controls

- RLS and explicit grants on every exposed table; private helpers in
  `lozzi_private` with pinned `search_path` and default execute revoked.
- Authorization from memberships, sections, and advisor assignments.
- No anonymous domain-table privileges.
- Share token hashes, narrow scopes, expiry and revocation.
- Fresh 32-byte salt per commitment plus domain and institution separation.
- Per-object AES-256-GCM data keys wrapped outside PostgreSQL. A future
  recipient package may use ECIES; keys never enter DB, Git, logs, or client
  bundles.
- Nonce CSP, secure headers, same-origin checks, cookie sessions, dependency
  audit, secret scanning, and PII-free structured logs.

## Residual risks

Supabase and the institution remain trusted processors. Timing and signer
activity become public after deployment. A malicious authorized registrar can
enter false data; append-only versioning and audit evidence improve
accountability but cannot prove real-world truth.
