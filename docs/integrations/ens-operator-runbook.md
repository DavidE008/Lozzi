# ENS operator runbook

Status: deployment-preparation draft. Every step that creates a Safe, registers
or wraps a name, deploys a contract, grants approval, funds an address, or
changes an ENS record is a distinct live Sepolia transaction and requires
explicit approval immediately before execution.

This runbook activates the locally implemented ENS integration without treating
testnet infrastructure as authoritative SIS state. It does not authorize
mainnet activity. The student flow and World prerequisite are documented in the
[World + ENS identity journey](world-ens-identity-journey.md).

## Required decisions

Record these in an approved change request before any live action:

- normalized `.eth` parent label and registration duration;
- three independent Safe owners and a threshold of two;
- renewal owner and 180/90/30-day escalation contacts;
- managed signer operator and issuance address;
- independent Sepolia write and read RPC providers;
- canary wallet, fee ceiling, funding ceiling, and monitoring window;
- Safe revocation approvers and reconciliation scheduler owner.

Do not place owner keys, signer credentials, RPC credentials, the reconciliation
secret, or a Safe recovery phrase in the repository or evidence document.

## Local validation gate

From the repository root:

```powershell
pnpm --filter @lozzi/contracts compile
pnpm --filter @lozzi/domain typecheck
pnpm --filter @lozzi/web typecheck
pnpm --filter @lozzi/domain lint
pnpm --filter @lozzi/web lint
pnpm --filter @lozzi/domain test
pnpm --filter @lozzi/web test
node scripts/scan-secrets.mjs
```

Foundry and local Supabase are mandatory before approval:

```powershell
pnpm contracts:test
pnpm db:test
```

Do not waive these commands because `solcjs` or TypeScript checks pass. Run the
Solidity suite on a Sepolia fork and rehearse parent wrapping, adapter approval,
issuance, replay, and Safe-controlled clearing.

## Transaction approval sequence

Stop after every numbered item, record the evidence, and obtain the next
approval.

1. Create the dedicated 2-of-3 Safe. Verify the exact owners and threshold
   independently in the Safe interface and through `getOwners()` /
   `getThreshold()`. The Safe must hold no unrelated ENS names or assets.
2. Register the approved parent to the Safe for the approved duration.
3. Wrap the parent without burning irreversible fuses. Verify the ENS Registry
   owner is the official Name Wrapper and the wrapper owner is the Safe.
4. Deploy `InstitutionalEnsRegistrar` with the official Sepolia Registry, Name
   Wrapper, Public Resolver, parent node, Safe, and managed issuer address.
5. Source-verify the adapter and record its deployment block and runtime code
   hash. Confirm all constructor immutables, owner, issuer, and paused state.
6. From the Safe, grant Name Wrapper operator approval to the adapter. Confirm
   the approval on both independent RPCs.
7. Fund only the managed issuer address, only to the approved canary ceiling.
8. Configure the runtime and reconciliation schedule, then run the read-only
   verifier below.
9. Issue one generated alias to a synthetic wallet with explicit consent.
10. Confirm the indexed event, configured confirmations, official resolver,
    Safe subname ownership, and independent forward resolution.

The adapter approval is broad across wrapped names held by that Safe. If the Safe
contains anything unrelated, stop and create a dedicated Safe.

## Runtime configuration

Populate deployment secrets outside Git:

```dotenv
NEXT_PUBLIC_ENS_PARENT=
ENS_PARENT_SAFE_ADDRESS=
ENS_PARENT_SAFE_OWNERS=
ENS_PARENT_SAFE_THRESHOLD=2
ENS_REGISTRAR_ADDRESS=
ENS_REGISTRAR_CODE_HASH=
ENS_REGISTRAR_DEPLOYMENT_BLOCK=
ENS_SEPOLIA_WRITE_RPC_URL=
ENS_SEPOLIA_READ_RPC_URL=
ENS_SIGNER_PROVIDER=json-rpc
ENS_SIGNER_ADDRESS=
ENS_SIGNER_RPC_URL=
ENS_CONFIRMATIONS=3
ENS_MAX_GAS=800000
ENS_MAX_FEE_WEI=10000000000000000
ENS_RECONCILIATION_SECRET=
```

`ENS_PARENT_SAFE_OWNERS` is a comma-separated address list. Production rejects
the raw-private-key signer mode and identical read/write RPC URLs.

Run the read-only verification from an environment containing those values:

```powershell
pnpm --filter @lozzi/web ens:verify-deployment
```

It checks Sepolia chain IDs, official ENS bytecode, adapter code hash and
immutables, Safe owners/threshold, wrapped-parent owner and expiry, issuer,
paused state, and adapter approval. It prints addresses and verification
evidence, never RPC URLs or credentials.

## Reconciliation

Schedule an authenticated `POST /api/internal/ens/reconcile` with:

```text
Authorization: Bearer <ENS_RECONCILIATION_SECRET>
```

The worker searches `SubnameIssued` by stable request key when a broadcast may
have succeeded before its hash was stored. A `submitting` operation with no
matching event is never resubmitted automatically. Submitted transactions are
activated only after the configured confirmations and independent resolution.

## Wallet and alias revocation

Wallet revocation takes effect in Lozzi immediately and changes an active alias
to `revocation-pending`. It does not erase historical blockchain data.

For the public record:

1. Build and simulate a Safe transaction that clears the alias's forward
   resolution while preserving Safe ownership and the approved parent.
2. Have two approved Safe owners inspect the exact parent, label/node, resolver,
   and zero target before signing.
3. Execute only after transaction-specific approval.
4. Wait for the configured confirmations.
5. Run the reconciliation endpoint. It independently verifies that forward
   resolution is `null` before the database can transition to `revoked`.

Never mark a row revoked from a Safe proposal, signature collection, transaction
hash, or single-RPC observation alone.

## Evidence record

For each approved action, record:

- change-request/approval reference;
- chain ID, address, transaction hash, block number, and explorer link;
- parent name/node, expiry, wrapped owner, and fuses;
- Safe address, exact owner set, and threshold;
- adapter address, source-verification link, deployment block, runtime code
  hash, immutables, owner, issuer, and paused state;
- operator approval and managed issuer funding ceiling;
- canary request ID/request key, alias, consenting synthetic wallet, event,
  confirmations, resolver, and independent resolution;
- reconciliation and no-duplicate replay results;
- renewal, monitoring, pause, issuer-rotation, approval-revocation, and
  Safe-clearing owners.

If evidence is incomplete or either RPC disagrees, keep the capability
`not-configured` or `failed`.
