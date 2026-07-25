# Lozzi

Lozzi is a privacy-first, verifiable Student Information System for colleges
and universities. Milestones 0–5 establish the product, security, normalized
data, contract, CI, authenticated role products, deterministic registration and
grades, record versioning, degree progress, and optional partner boundaries.
No contract is deployed and no unconfigured partner is presented as live.

## Synthetic student demo

The public demo account is intentionally restricted to one synthetic student:

- Email: `aisha.demo@lozzi.example`
- Password: `Northstar-Demo-2026!`

Never use real student information in this environment. The account can view
only Aisha Rahman's seeded Northstar University record and cannot mutate
academic records.

The complete synthetic role/account matrix for development, testing, and
eventual demos is in
[docs/testing/test-accounts.md](docs/testing/test-accounts.md). Those
credentials are deliberately non-production and must never be reused.

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
- [Milestone 3 product scope](docs/product/milestone-3.md)
- [Milestone 3 registration design contract](docs/design/registration-contract.md)
- [Milestone 3 acceptance evidence](docs/verification/milestone-3.md)
- [Milestone 4 acceptance evidence](docs/verification/milestone-4.md)
- [Milestone 5 partner scope](docs/product/milestone-5.md)
- [Milestone 5 fidelity review](docs/design/milestone-5-fidelity-review.md)
- [Milestone 5 acceptance evidence](docs/verification/milestone-5.md)
- [Synthetic test and demo accounts](docs/testing/test-accounts.md)
- [World real-configuration runbook](docs/integrations/world-real-configuration.md)
- [World prize evidence](docs/integrations/world-prize-evidence.md)

World integration code is present, but Portal beta access, runtime secrets,
production device evidence, and AgentBook registration are still deliberately
unconfirmed. ENS, 0G, WalletConnect, and World Chain registry deployment remain
unconfigured. The app reports those states honestly, and no Lozzi registry
contract has been deployed.
