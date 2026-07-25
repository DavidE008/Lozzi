# Lozzi

Lozzi is a privacy-first, verifiable Student Information System for colleges
and universities. Milestones 0–2 establish the product, security, data,
contract, CI, authenticated student dashboard, and institution-scoped
registrar foundations without deploying contracts or claiming live partner
integrations.

## Synthetic student demo

The public demo account is intentionally restricted to one synthetic student:

- Email: `aisha.demo@lozzi.example`
- Password: `Northstar-Demo-2026!`

Never use real student information in this environment. The account can view
only Aisha Rahman's seeded Northstar University record and cannot mutate
academic records.

## Requirements

- Node.js 24
- pnpm 11.9.0
- Docker for local Supabase database tests
- Foundry for contract tests

## Start

```bash
pnpm install --frozen-lockfile
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

Set the public Supabase URL and publishable key in `apps/web/.env.local`.
Service-role keys, database passwords, wallet keys, and object-encryption keys
must never enter the browser, repository, logs, or PostgreSQL.

## Verification

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm audit:dependencies
pnpm contracts:test
pnpm secrets:scan
```

Run `supabase start && supabase db reset && supabase test db` when Docker is
available. See [docs/submission-checklist.md](docs/submission-checklist.md) for
the complete acceptance record and remaining partner credentials.

## Architecture and design evidence

- [System architecture and trust boundaries](docs/architecture/system.md)
- [Privacy threat model](docs/architecture/privacy-threat-model.md)
- [Normalized data model](docs/architecture/data-model.md)
- [Registry proposal](docs/contracts/registry-proposal.md)
- [Approved design specification](docs/design/specification.md)
- [Dashboard fidelity review](docs/design/fidelity-review.md)
- [Milestones 0–1 acceptance evidence](docs/verification/acceptance.md)
- [Registrar fidelity review](docs/design/registrar-fidelity-review.md)
- [Milestone 2 acceptance evidence](docs/verification/milestone-2.md)

World, ENS, 0G, WalletConnect, and World Chain deployment are deliberately
unconfigured. The app reports that state honestly, and no registry has been
deployed.
