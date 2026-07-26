# Milestone 7 CROPS review

Chosen default:

- Keep the institution-scoped SIS authoritative offchain and publish only
  opaque commitments, expirations, and revocation state if deployment is later
  approved. Use a reproducible, MIT-licensed Next.js deployment with Vercel as
  an initial operational host, document self-hosting and alternate RPCs, and
  retain a separately deployable public-verifier path. Put lasting contract
  authority behind a reviewed Safe with bounded roles. This is the most
  CROPS-aligned option that still supports Lozzi's authenticated server routes;
  a static IPFS frontend alone cannot replace them.

## Censorship resistance

- Risk: the institution, Vercel, Supabase, World, an RPC provider, a relayer,
  the selected chain, or ENS governance can block part of the experience.
- Mitigation: partner paths are optional and fail closed; the core source,
  migrations, ABIs, adapters, and evidence formats are public. Critical
  contract reads require primary and independent RPC agreement. Future admin
  roles are bounded and assigned to a Safe rather than a single retained
  deployer.
- User escape: operators can fork and self-host the web/database stack, switch
  RPCs, and independently read verified contracts. This escape is incomplete
  until production build instructions, deployed addresses, source
  verification, and an alternate-host exercise exist.

## Open (visibility)

- Risk: a Vercel deployment, Supabase project, World API, managed relayer, or
  ENS operator could become an opaque dependency even though the repository is
  public.
- Mitigation: the whole Lozzi repository is public under MIT, dependencies are
  pinned, CI is public, deployment inputs have versioned schemas, and no
  backend-only academic rule is hidden from the repository. A future live
  deployment must point to a pinned commit and publish addresses, ABIs,
  bytecode hashes, constructor arguments, and provider boundaries.
- User escape: a third party can legally rebuild and operate the source.
  Reproduction of a live environment remains unproven until hosting and
  deployment evidence is published.

## Free, as in Freedom (license)

- Risk: hosted providers and partner terms can still restrict a running
  instance even when the application license is permissive.
- Mitigation: the repository uses the OSI-approved MIT license and does not
  require a proprietary Lozzi client. Provider adapters can be disabled or
  replaced without changing authoritative academic semantics.
- User escape: users and institutions may fork, modify, redistribute, and run
  Lozzi without project permission, subject to their separately chosen
  providers' terms.

## Privacy

- Risk: hosts and RPCs observe IP/timing metadata; World observes proof
  traffic; ENS makes an alias-to-wallet relationship public; registry
  transactions expose commitments and lifecycle timing. Combining those
  sources can increase linkability.
- Mitigation: academic records, grades, names, emails, student numbers, proof
  bodies, identity attributes, and wallet-to-student mappings stay offchain.
  World is purpose-bound, ENS requires separate alias consent, registry writes
  use institution-relayed opaque commitments, and the public verifier returns
  minimum state. No analytics or tracking pixel is configured.
- User escape: World, ENS, and anchoring are unnecessary for ordinary SIS
  access. A student can decline the public alias and sharing path. Complete
  metadata privacy is not promised once a public wallet or transaction is
  used.

## Security

- Risk: Supabase service authority, World RP signing, ENS issuance, registry
  administration, relayer funding, and deployment credentials are high-value
  capabilities. An immutable bad deployment cannot be rolled back.
- Mitigation: production design excludes raw keys from Git and review packets,
  separates Safe/deployer/relayer roles, caps value and gas, requires
  transaction-specific approval, validates code through two RPCs, and keeps
  the worker disabled by default. Tests, fuzzing, invariants, privacy scans,
  bytecode fingerprints, source verification, Slither, and an independent
  review are deployment gates.
- User escape: compromised signers can be revoked and the worker halted;
  contracts expose independent reads. Recovery from finalized bad bytecode is
  a newly governed replacement plus offchain canonical-state reconciliation,
  not rollback. The walkaway test is therefore only partially satisfied.

## Accepted compromises

- Lozzi is an institution-operated SIS, not a hyperstructure. The institution
  can deny academic administration, and a hosted frontend/database creates
  availability and metadata dependencies.
- Vercel is the proposed initial host because the current Next.js server routes
  are not a static site. This is accepted only with pinned builds,
  self-hosting documentation, alternate RPCs, and a future alternate-host
  rehearsal.
- Supabase remains the authoritative private store. Public commitments improve
  independent verification but do not make private records independently
  available.
- World and ENS are optional partner tracks with external entitlement,
  governance, and availability risk. No live claim is made until their
  evidence gates pass.
