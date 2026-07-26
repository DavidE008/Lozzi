# Milestone 6 transaction approval

Status: `UNAPPROVED`

This template is evidence only. It is not a signature, Safe proposal, raw
transaction, deployment authorization, or broadcast instruction.

## Packet identity

| Field                        | Exact value |
| ---------------------------- | ----------- |
| Packet ID                    |             |
| Transaction approval ID      |             |
| Sequence / total             |             |
| Approval expiry              |             |
| Pinned Git commit            |             |
| Manifest Keccak-256          |             |
| Simulation report Keccak-256 |             |
| Chain name / chain ID        |             |
| Fork block number / hash     |             |

## Decoded transaction

| Field                       | Exact value |
| --------------------------- | ----------- |
| Sender                      |             |
| Sender governance role      |             |
| Nonce or nonce constraint   |             |
| Target (`CREATE` if absent) |             |
| Transaction value           | `0`         |
| Decoded action              |             |
| Decoded arguments           |             |
| Complete data Keccak-256    |             |
| Expected created address    |             |
| Expected runtime code hash  |             |
| Gas estimate                |             |
| Gas limit                   |             |
| Maximum fee per gas         |             |
| Maximum priority fee        |             |
| Maximum total cost          |             |

Do not paste a signature, raw transaction, private key, key identifier,
credential, token, commitment key/salt/preimage, institution name, student
identifier, or academic attribute.

## Expected effects

- Expected commitment-only events:
- Expected role changes:
- Expected code/storage reads:
- Expected balance change:
- Explicitly unchanged state:
- Independent RPC/readback procedure:

## Simulation evidence

- Simulator and pinned version:
- `broadcast: false` confirmed:
- `signedTransactionCount: 0` confirmed:
- Exact transaction passed:
- Failure-path simulations passed:
- Primary and independent readback agree:
- Findings and dispositions:

## Abort conditions

- Any field above differs.
- Approval expired or transaction order changed.
- Chain, RPC, Safe, bytecode, constructor, role, gas, fee, or funding mismatch.
- Unexpected revert, event, state change, value transfer, or contract creation.
- Missing independent readback.
- Ambiguous or possibly submitted prior transaction.
- Secret or private data appears in evidence.

## Review and decision

| Role                   | Named person | Decision and timestamp |
| ---------------------- | ------------ | ---------------------- |
| Preparer               |              | Prepared               |
| Independent reviewer   |              | Reject                 |
| Institutional approver |              | Reject                 |
| Security approver      |              | Reject                 |

Default decision is `Reject`. Change a decision only through the approved
human process after every field and checklist item is complete. A recorded
approval still requires a separate explicit instruction before funding,
signing, Safe submission, or broadcast.
