# Partner integration plan

The active demo focus is deliberately limited to **World + ENS**:

> Lozzi is a privacy-first student information system where World verifies the
> person and ENS gives that student a readable, institution-issued digital
> identity. Academic records remain private and offchain, while the student
> controls wallet linking, identity consent, and record sharing.

0G abstractions and documentation remain in the repository, but provisioning,
funding, integration expansion, and completion claims are paused. WalletConnect,
World AgentKit, and World Chain registry work are not part of the current
identity demo.

All partner adapters expose one of four typed states: `available`,
`mock-development`, `not-configured`, or `failed`. Development mocks are
visibly labeled and cannot run in production.

| Partner                                      | Current boundary                                                                                         | Live evidence requirement                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| World                                        | Purpose-bound IDKit 4.x verification and existing share step-ups                                         | Real proof plus user/purpose/action/environment binding and replay-denial evidence |
| ENS                                          | SIWE wallet proof, consented generated alias, durable Sepolia issuance lifecycle, parent-bound registrar | Approved deployment plus confirmed issuance and independent resolution             |
| 0G Storage / Compute                         | Existing server-only abstractions preserved; work paused                                                 | Not presented as complete                                                          |
| World AgentKit / World Chain / WalletConnect | Existing boundaries preserved; outside the current demo                                                  | Not presented as complete                                                          |

No browser bundle imports RP signing keys, deployment keys, a 0G Direct SDK,
storage or ENS signer material, wrapping keys, service-role keys, or Router API
keys. Partner failure never blocks the core SIS dashboard. Development mocks
are visibly labeled and cannot produce a production success state.

The World Developer Portal API key is an operator-only Codex MCP credential and
is never a Lozzi runtime variable. World ID environments are explicit:
`staging` for simulator evidence, `sandbox` for Selfie Check, and `production`
for real World App QA.

Real ENS activation follows the
[ENS integration plan](integrations/ens-real-integration-plan.md). In
particular, account-humanity World verification is required before wallet
linking, a database `verified` wallet is insufficient without a live SIWE
challenge, and raw-key signing is never a production design. The combined
student journey and trust boundaries are documented in the
[World + ENS identity journey](integrations/world-ens-identity-journey.md).
