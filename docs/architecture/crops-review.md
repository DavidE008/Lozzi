# CROPS review

Chosen default: keep identity and academic data offchain under institutional
RLS; publish only salted commitments through two immutable, non-proxy
registries later.

## Censorship resistance

- Risk: Supabase, the web host, or an institutional signer can block the
  primary experience or delay commitments.
- Mitigation: MIT-licensed reproducible code, explicit adapters, durable
  outbox, public ABIs, no required partner path for core SIS reads.
- User escape: export and alternate/self-host paths are part of later scope;
  public commitment reads remain callable without Lozzi once deployed.

## Open and free

- Risk: hosted services can become opaque dependencies.
- Mitigation: the entire schema, policies, contracts, fixtures, build steps,
  and integration boundaries are public under MIT.
- User escape: another operator may legally fork and run the stack.

## Privacy

- Risk: public transactions can link institution signers, timestamps, and
  commitments; RPC and auth providers see network metadata.
- Mitigation: salted domain-separated commitments, pseudonymous student IDs,
  institutional relay, no analytics, no sensitive strings or ENS text.
- User escape: core SIS works with every partner state set to not configured;
  no student wallet is required for Milestones 0–1.

## Security

- Risk: registrar accounts, server credentials, signer keys, and wrapping keys
  are high-value capabilities; hosted vendors create liveness dependencies.
- Mitigation: RLS from memberships/assignments, explicit grants, least
  privilege, immutable contracts, signer deactivation, same-origin mutation
  checks, secure cookies, PII-free logs, idempotency.
- User escape: if onchain infrastructure disappears, the SIS remains usable;
  if the app server disappears, public registries remain readable.

Accepted compromise: the MVP is a hosted institutional system, not a
hyperstructure. Censorship resistance applies to later verification proofs,
not to privileged academic administration.
