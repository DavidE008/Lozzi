# Partner integration plan

All partner adapters expose one of four typed states: `available`,
`mock-development`, `not-configured`, or `failed`. Development mocks are
visibly labeled and cannot run in production.

| Partner             | Milestone 5 boundary                               | Live evidence requirement                           |
| ------------------- | -------------------------------------------------- | --------------------------------------------------- |
| World               | IDKit 4.x RP signing and server proof verification | Successful proof plus replay-denial database test   |
| World Chain Sepolia | Chain metadata only, ID 4801                       | Remains Milestone 6                                 |
| ENS                 | Resolution plus Ethereum Sepolia subname adapter   | Successful lookup; issuance only with parent access |
| 0G Storage          | Server-only encrypted-object adapter               | Ciphertext upload and verified root hash            |
| 0G Compute          | Server-only Router progress explanation            | Real validated response from a funded Router key    |
| WalletConnect       | Capability detection only                          | Explicit student-consent signing remains later      |

No browser bundle imports RP signing keys, deployment keys, a 0G Direct SDK,
storage or ENS signer material, wrapping keys, service-role keys, or Router API
keys. Partner failure never blocks the core SIS dashboard. Development mocks
are visibly labeled and cannot produce a production success state.
