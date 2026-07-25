# Partner integration plan

All partner adapters expose one of four typed states: `available`,
`mock-development`, `not-configured`, or `failed`. Development mocks are
visibly labeled and cannot run in production.

| Partner             | Milestone 1                                  | Later production boundary                        |
| ------------------- | -------------------------------------------- | ------------------------------------------------ |
| World               | Not configured; separate verification signal | Server validates proof, stores minimum result    |
| World Chain Sepolia | Chain metadata only, ID 4801                 | Institutional signer relays outbox commitments   |
| ENS                 | Ethereum Sepolia adapter contract interface  | Institution controls a parent; no sensitive text |
| 0G Compute          | Server-only provider interface               | Router request after policy and redaction        |
| WalletConnect       | Capability detection only                    | Explicit student-consent signing UX              |

No browser bundle imports deployment keys, a 0G Direct SDK, service-role keys,
or signer material. Partner failure never blocks the core SIS dashboard.
