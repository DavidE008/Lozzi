# Milestone 6 constructor and bytecode record

Status: reproducible build record; deployment inputs are not approved.

The registry deployment manifest is pinned to source commit
`c7fed38f15b64dc995cfba024d44bdab9457e437`. The contract build uses Solidity
`0.8.30`, EVM `cancun`, optimizer enabled, and 200 optimizer runs. Changing a
contract source, dependency, compiler, EVM target, optimizer setting, or
lockfile invalidates this record and requires a new fingerprint and review.

## Reproducible bytecode fingerprints

| Contract                    | Creation bytecode Keccak-256                                         | Runtime template Keccak-256                                          | Constructor-dependent runtime |
| --------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------- |
| `InstitutionRegistry`       | `0xff8eee6ce6dde92829858d08c0ff18c12c87b0d13e6dfb90d1007f436ff48e05` | `0xcf6433c1732e47e924891684662d6f5b0e4f759106d4e35ce5bebf5f458f807c` | No                            |
| `AcademicRecordRegistry`    | `0x50af864bfe558f50f2eb5ba4147c4f1a4538d6cc9799c036750a4c2722f6ed23` | `0x3897d65a7f053e1934ff46f1eea85b33e9356b46f8ed940a8e03cb1fa75a8ee6` | Yes, 7 references             |
| `InstitutionalEnsRegistrar` | `0x978adb2874bd1514b34fe6afa6d638b37f25c1e2e0ca5bfac1d9aa6358f21262` | `0xb6d4970ef22ba7f546030863432400ab9812c58b47a5aee4d891c56119a16e9e` | Yes, 22 references            |

The runtime template contains zero placeholders for immutables. It is not an
expected deployed runtime hash when the final column is `Yes`. After exact
constructor arguments are approved, an unsigned fork simulation must produce
the actual runtime code. Record its Keccak-256 hash in the deployment manifest,
then reproduce it independently before any transaction approval.

Run `pnpm deployment:bytecode:check` after a Forge build to compare local
artifacts with
`deployment/milestone-6/bytecode-fingerprints.json`.

## Registry constructor arguments

### `InstitutionRegistry`

```text
constructor(address protocolAdministrator)
```

| Position | Name                    | Required value                                                                                          |
| -------- | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| 0        | `protocolAdministrator` | Exact approved Safe address. It receives `DEFAULT_ADMIN_ROLE`; a deployer EOA must not retain the role. |

The address must be nonzero. The Safe owner set and threshold are separate
manifest fields and must be independently read from the Safe before approval.

### `AcademicRecordRegistry`

```text
constructor(IInstitutionRegistry registry)
```

| Position | Name       | Required value                                                                   |
| -------- | ---------- | -------------------------------------------------------------------------------- |
| 0        | `registry` | Exact expected address of the `InstitutionRegistry` from transaction sequence 1. |

The address must be nonzero. It is embedded as an immutable, so its value
changes the deployed runtime bytecode hash. Simulation must confirm that the
public `institutionRegistry()` read returns the same address through both the
primary and independent RPCs.

## Initial institution authorization transaction

The third transaction is not a constructor call. The approved Safe calls:

```text
registerInstitution(
  bytes32 institutionId,
  address administrator,
  address signer,
  bytes32 idempotencyKey
)
```

`institutionId` and `idempotencyKey` must be opaque, domain-separated
commitments generated outside the approval document. The approval document may
contain their final `bytes32` values but must not contain the institution name,
student data, a commitment key, salt, or preimage.

The administrator must be the approved institution governance address. The
signer must be the public address of the narrowly authorized managed relayer.
The transaction value is exactly zero.

## ENS constructor is a separate deployment lane

`InstitutionalEnsRegistrar` is not part of the registry transaction batch. It
targets ENS infrastructure on a separately approved chain and has different
custody and governance prerequisites:

```text
constructor(
  IEnsRegistry registry,
  INameWrapper wrapper,
  IPublicResolver resolver,
  bytes32 parentNode,
  address safeOwner,
  address issuer
)
```

Every address, the parent node, parent expiry, wrapper custody, Safe ownership,
and issuer authorization remain unresolved. Use a separate instance of the
versioned manifest only after the ENS parent and chain are approved. Never put
registry and ENS transactions from different chains in one approval batch.
Follow `docs/integrations/ens-operator-runbook.md` and reproduce the final
constructor-dependent runtime hash.

## Transaction data fingerprint

For each creation transaction, the approval packet records:

1. creation bytecode from the pinned artifact;
2. ABI-encoded constructor arguments in the documented order;
3. Keccak-256 of the complete creation data;
4. expected address from the exact deployer and nonce used in simulation;
5. simulated gas estimate and separately approved gas limit;
6. expected deployed runtime bytecode hash; and
7. zero transaction value.

The packet stores hashes and decoded values, not a signed or raw serialized
transaction. Any change to the deployer, nonce, constructor argument, data,
value, gas limit, fee bound, chain ID, or source commit invalidates the approval.
