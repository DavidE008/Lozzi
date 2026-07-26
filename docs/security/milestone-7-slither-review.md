# Milestone 7 Slither review

Status: local triage completed; independent pre-deployment acceptance required.

This record does not claim an audit or production readiness. It documents the
Slither 0.11.5 result against the four first-party contracts so that a future
independent reviewer can reproduce and accept or reject each disposition.

## Reproduction

The analysis ran from an LF-normalized, disposable copy of the checked-in
contract package using the same Foundry v1.7.1 toolchain as CI:

```text
slither . --config-file slither.config.json
```

The checked-in configuration excludes dependencies and tests. No source,
storage layout, contract behavior, deployment template, or bytecode
fingerprint changed during this review.

Slither analyzed 18 contracts including interfaces and reported 18 first-party
findings:

| Detector              | Severity | Confidence | Count |
| --------------------- | -------- | ---------- | ----: |
| `incorrect-equality`  | Medium   | High       |     2 |
| `uninitialized-local` | Medium   | Medium     |     1 |
| `unused-return`       | Medium   | Medium     |     4 |
| `reentrancy-benign`   | Low      | Medium     |     1 |
| `timestamp`           | Low      | Medium     |    10 |

No high-severity finding was reported.

## Local disposition

### Strict equality sentinel

`InstitutionRegistry.getInstitution` and
`InstitutionRegistry._requireActiveInstitution` compare `registeredAt` with
zero. Registration writes the current block timestamp and zero is the explicit
not-registered sentinel. A live target cannot legitimately register at the
genesis timestamp, but the independent reviewer must confirm the candidate
chain's current timestamp and accept the sentinel design. Replacing it with a
separate existence flag would change storage and bytecode and is not approved
as part of submission preparation.

### Default-initialized label state

`InstitutionalEnsRegistrar._validateLabel` declares
`previousWasHyphen` without an explicit initializer. Solidity initializes the
local boolean to `false`, which is the required initial state before scanning
the first character. An explicit initializer would improve analyzer clarity
but would require regenerating and independently reproducing the deployment
bytecode evidence. There is no behavioral bypass: leading and trailing
hyphens, consecutive hyphens, invalid characters, and length bounds are
covered by the registrar tests.

### Intentionally ignored ENS tuple components

Four `NameWrapper.getData` calls intentionally ignore the fuse field and, for
child readbacks, the expiry field. The code checks the owner and every expiry
needed for parent validity, relies on `NameWrapper` to reject prohibited fuse
operations, and verifies the final wrapped owner, registry owner, resolver,
and resolved address. A prohibited operation therefore reverts instead of
issuing a partially configured subname.

The actual parent does not exist yet. Before deployment, the independent
reviewer must inspect the approved parent owner, expiry, fuses, wrapper code
hash, resolver code hash, and an unsigned fork simulation. This local
disposition does not approve any parent or contract address.

### Expected ENS receipt callback

The reported state writes after `setSubnodeOwner` are part of the expected
ERC-1155 receipt handshake. `issue` is `nonReentrant`; request and label
idempotency state is written before the external call; and the callback accepts
only the configured wrapper, this registrar as operator, mint origin, exact
expected node, unit value, and a single observation. The function then clears
the callback state and independently verifies final ownership and resolution.

Deployment review must still pin the official wrapper code and reproduce the
callback path in the unsigned simulation. No generic or batch receipt path is
accepted.

### Lifecycle timestamps

Ten findings cover the institution registration sentinel, record publication
time, share expiration, and ENS parent expiry checks. These timestamps govern
lifecycle validity; they do not select winners, calculate prices, move funds,
or disclose academic content. Small validator timestamp variation cannot
create an unbounded grant, and expired parents or grants fail closed.

The independent reviewer must confirm the target chain's timestamp behavior
and the product's accepted expiration tolerance before deployment.

## Required next decision

An independent reviewer must either:

1. accept every disposition for the exact pinned commit and proposed
   deployment configuration; or
2. request a code change, after which all Forge tests, fuzz/invariant runs,
   Slither, bytecode fingerprints, manifests, simulations, and transaction
   approval packets must be regenerated.

Neither option authorizes deployment, signing, funding, Safe submission,
broadcast, provisioning, or an onchain transaction.
