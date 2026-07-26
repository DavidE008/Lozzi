# Milestone 6 governance and authorization matrix

Status: proposed least-privilege model; addresses and people are unresolved.

The matrix describes capabilities, not approved actors. Every address in the
deployment manifest remains `null` until governance owners, independence,
recovery, and provider controls are approved. No key material belongs in the
manifest or evidence packet.

## Governance roles

| Role                       | Proposed holder                               | Allowed capability                                                                                        | Explicitly forbidden or absent                                                                               | Revocation or halt path                                                         |
| -------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Human deployment approver  | Named institutional risk owner                | Approve one exact, expiring transaction packet after independent review                                   | Signing by implication, blanket future approval, changing packet values                                      | Reject or let packet expire                                                     |
| Independent reviewer       | Person independent from preparer              | Reproduce build, decode transactions, review simulation and readback plan                                 | Preparing the same packet, holding deployment credentials as part of review                                  | Record rejection and unresolved findings                                        |
| Safe owners                | Independently controlled institutional owners | Meet the approved threshold for protocol and institution governance                                       | Shared seed, single custodian, unrelated ENS/assets in an ENS-dedicated Safe, delegated relayer operation    | Safe owner recovery or governed owner change; separate transaction approval     |
| Protocol administrator     | Approved Safe                                 | Hold `DEFAULT_ADMIN_ROLE`; register institutions; manage protocol-level role administration               | Routine record anchoring, arbitrary student-data access, browser signing                                     | Safe rejects actions; governed role change or replacement-contract plan         |
| Institution administrator  | Approved institution governance address       | Manage institution signers; deactivate its institution                                                    | Publishing record or share commitments unless separately authorized as signer                                | Revoke signer authorization or deactivate institution                           |
| Institution signer         | Narrow managed-relayer address                | Call only `publishRecordVersion`, `createShareGrant`, and `revokeShareGrant` for the approved institution | Contract deployment, role administration, nonzero-value calls, arbitrary calldata, other chains or contracts | Institution administrator revokes signer; operator disables provider and worker |
| Deployment account         | Approved temporary deployment address         | Create the two reviewed contracts within the deployment funding and gas ceilings                          | Retained admin role, record writes, unlimited funding, unrelated transactions                                | Remove funding after batch; do not reuse without a new approval                 |
| Emergency governance owner | Approved Safe or formally delegated committee | Deactivate an institution, halt worker/relayer offchain, approve replacement or recovery proposal         | Reversing a finalized transaction, bypassing transaction review, restoring revoked offchain access           | Governance replacement under a separate reviewed action                         |
| Outbox worker              | Server-only process                           | Claim events, simulate, reconcile receipts, stop cleanly                                                  | Holding keys, signing, broadcasting in the current implementation, overriding canonical PostgreSQL state     | Disable worker configuration and expire leases                                  |
| Primary RPC                | Approved provider                             | Simulation and primary readback                                                                           | Sole source of truth                                                                                         | Fail over only after independent agreement                                      |
| Independent RPC            | Operationally independent provider            | Wrong-chain, code, receipt, event, and state cross-check                                                  | Sharing the primary provider endpoint or silently resolving disagreement                                     | Halt reconciliation until agreement or incident resolution                      |

## Managed relayer authorization

The relayer policy in the manifest is exact and deny-by-default:

| Dimension        | Required bound                                                                |
| ---------------- | ----------------------------------------------------------------------------- |
| Chain            | One approved chain ID                                                         |
| Contract         | One `AcademicRecordRegistry` address                                          |
| Methods          | `publishRecordVersion`, `createShareGrant`, `revokeShareGrant` only           |
| Value            | Exactly zero                                                                  |
| Gas              | Per-transaction ceiling from the approved manifest                            |
| Funding          | Daily native-currency ceiling from the approved manifest                      |
| Idempotency      | Durable outbox operation key                                                  |
| Data             | Commitments, expiration, and authorization metadata only                      |
| Response         | Immutable provider operation ID; no key, secret, or reusable signing material |
| Failure behavior | Reject wrong chain, contract, selector, value, gas, funding, or duplicate key |

The current registry adapter does not contain a wallet client, signing method,
raw transaction method, or broadcast method. Adding any of those is a separate
implementation and approval scope.

## Safe decisions that remain open

- exact Safe address, owners, threshold, recovery policy, and owner independence;
- whether protocol and institution administration use the same Safe or separate
  governance addresses;
- emergency decision owner and response-time expectation;
- managed-relayer provider, authentication mechanism, permission enforcement,
  funding source, and revocation owner;
- deployer custody, nonce plan, funding ceiling, and post-deployment disposal;
- target chain, RPC providers, confirmation depth, and explorer;
- whether ENS uses a dedicated Safe distinct from registry governance.

No template value resolves these decisions. A later approval must name the
exact actors and evidence.
