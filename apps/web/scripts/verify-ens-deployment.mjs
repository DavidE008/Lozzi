import {
  createPublicClient,
  getAddress,
  http,
  keccak256,
  namehash,
} from "viem";
import { sepolia } from "viem/chains";
import { normalize } from "viem/ens";

const OFFICIAL = {
  nameWrapper: getAddress("0x0635513f179D50A207757E05759CbD106d7dFcE8"),
  publicResolver: getAddress("0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5"),
  registry: getAddress("0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"),
  universalResolver: getAddress("0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe"),
};

const registrarAbi = [
  {
    type: "function",
    name: "ensRegistry",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "issuer",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "nameWrapper",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "parentNode",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "publicResolver",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
];

const registryAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [{ type: "bytes32" }],
    outputs: [{ type: "address" }],
  },
];

const wrapperAbi = [
  {
    type: "function",
    name: "getData",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "address" }, { type: "uint32" }, { type: "uint64" }],
  },
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }],
    outputs: [{ type: "bool" }],
  },
];

const safeAbi = [
  {
    type: "function",
    name: "getOwners",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
  {
    type: "function",
    name: "getThreshold",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
];

class VerificationError extends Error {}

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new VerificationError(`${name} is required`);
  return value;
};

const sameAddress = (left, right) =>
  getAddress(left).toLowerCase() === getAddress(right).toLowerCase();

const sameAddressSet = (observed, expected) => {
  const observedSet = new Set(
    observed.map((address) => getAddress(address).toLowerCase()),
  );
  const expectedSet = new Set(
    expected.map((address) => getAddress(address).toLowerCase()),
  );
  return (
    observedSet.size === expectedSet.size &&
    [...expectedSet].every((address) => observedSet.has(address))
  );
};

const assert = (condition, message) => {
  if (!condition) throw new VerificationError(message);
};

const run = async () => {
  const parentName = normalize(required("NEXT_PUBLIC_ENS_PARENT"));
  const safeAddress = getAddress(required("ENS_PARENT_SAFE_ADDRESS"));
  const safeOwners = required("ENS_PARENT_SAFE_OWNERS")
    .split(",")
    .map((address) => getAddress(address.trim()));
  const safeThreshold = BigInt(required("ENS_PARENT_SAFE_THRESHOLD"));
  const registrarAddress = getAddress(required("ENS_REGISTRAR_ADDRESS"));
  const registrarCodeHash = required("ENS_REGISTRAR_CODE_HASH");
  const signerAddress = getAddress(required("ENS_SIGNER_ADDRESS"));
  const writeRpcUrl = required("ENS_SEPOLIA_WRITE_RPC_URL");
  const readRpcUrl = required("ENS_SEPOLIA_READ_RPC_URL");
  assert(
    writeRpcUrl !== readRpcUrl,
    "Read and write RPC URLs must be independent",
  );
  assert(
    safeOwners.length >= Number(safeThreshold),
    "Safe threshold exceeds its expected owner count",
  );
  assert(
    new Set(safeOwners.map((address) => address.toLowerCase())).size ===
      safeOwners.length,
    "Expected Safe owner addresses must be unique",
  );

  const writeClient = createPublicClient({
    chain: sepolia,
    transport: http(writeRpcUrl),
  });
  const readClient = createPublicClient({
    chain: sepolia,
    transport: http(readRpcUrl),
  });
  const parentNode = namehash(parentName);

  const [
    writeChainId,
    readChainId,
    writeCode,
    readCode,
    registryCode,
    wrapperCode,
    publicResolverCode,
    universalResolverCode,
    safeCode,
    configuredRegistry,
    configuredWrapper,
    configuredResolver,
    configuredParent,
    configuredOwner,
    configuredIssuer,
    paused,
    registryParentOwner,
    parentData,
    approved,
    observedSafeOwners,
    observedSafeThreshold,
  ] = await Promise.all([
    writeClient.getChainId(),
    readClient.getChainId(),
    writeClient.getCode({ address: registrarAddress }),
    readClient.getCode({ address: registrarAddress }),
    readClient.getCode({ address: OFFICIAL.registry }),
    readClient.getCode({ address: OFFICIAL.nameWrapper }),
    readClient.getCode({ address: OFFICIAL.publicResolver }),
    readClient.getCode({ address: OFFICIAL.universalResolver }),
    readClient.getCode({ address: safeAddress }),
    readClient.readContract({
      abi: registrarAbi,
      address: registrarAddress,
      functionName: "ensRegistry",
    }),
    readClient.readContract({
      abi: registrarAbi,
      address: registrarAddress,
      functionName: "nameWrapper",
    }),
    readClient.readContract({
      abi: registrarAbi,
      address: registrarAddress,
      functionName: "publicResolver",
    }),
    readClient.readContract({
      abi: registrarAbi,
      address: registrarAddress,
      functionName: "parentNode",
    }),
    readClient.readContract({
      abi: registrarAbi,
      address: registrarAddress,
      functionName: "owner",
    }),
    readClient.readContract({
      abi: registrarAbi,
      address: registrarAddress,
      functionName: "issuer",
    }),
    readClient.readContract({
      abi: registrarAbi,
      address: registrarAddress,
      functionName: "paused",
    }),
    readClient.readContract({
      abi: registryAbi,
      address: OFFICIAL.registry,
      args: [parentNode],
      functionName: "owner",
    }),
    readClient.readContract({
      abi: wrapperAbi,
      address: OFFICIAL.nameWrapper,
      args: [BigInt(parentNode)],
      functionName: "getData",
    }),
    readClient.readContract({
      abi: wrapperAbi,
      address: OFFICIAL.nameWrapper,
      args: [safeAddress, registrarAddress],
      functionName: "isApprovedForAll",
    }),
    readClient.readContract({
      abi: safeAbi,
      address: safeAddress,
      functionName: "getOwners",
    }),
    readClient.readContract({
      abi: safeAbi,
      address: safeAddress,
      functionName: "getThreshold",
    }),
  ]);

  assert(writeChainId === sepolia.id, "Write RPC is not Ethereum Sepolia");
  assert(readChainId === sepolia.id, "Read RPC is not Ethereum Sepolia");
  for (const [label, code] of [
    ["registrar/write", writeCode],
    ["registrar/read", readCode],
    ["ENS Registry", registryCode],
    ["ENS Name Wrapper", wrapperCode],
    ["ENS Public Resolver", publicResolverCode],
    ["ENS Universal Resolver", universalResolverCode],
    ["Safe", safeCode],
  ]) {
    assert(code && code !== "0x", `${label} has no bytecode`);
  }
  assert(
    keccak256(writeCode).toLowerCase() === registrarCodeHash.toLowerCase(),
    "Write RPC registrar code hash mismatch",
  );
  assert(
    keccak256(readCode).toLowerCase() === registrarCodeHash.toLowerCase(),
    "Read RPC registrar code hash mismatch",
  );
  assert(
    sameAddress(configuredRegistry, OFFICIAL.registry),
    "Registry mismatch",
  );
  assert(
    sameAddress(configuredWrapper, OFFICIAL.nameWrapper),
    "Name Wrapper mismatch",
  );
  assert(
    sameAddress(configuredResolver, OFFICIAL.publicResolver),
    "Public Resolver mismatch",
  );
  assert(configuredParent === parentNode, "Parent node mismatch");
  assert(
    sameAddress(configuredOwner, safeAddress),
    "Registrar owner is not the Safe",
  );
  assert(
    sameAddress(configuredIssuer, signerAddress),
    "Registrar issuer mismatch",
  );
  assert(!paused, "Registrar is paused");
  assert(
    sameAddress(registryParentOwner, OFFICIAL.nameWrapper),
    "Parent is not wrapped",
  );
  assert(
    sameAddress(parentData[0], safeAddress),
    "Safe does not own the wrapped parent",
  );
  assert(
    parentData[2] > BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60),
    "Parent expires inside the 30-day safety window",
  );
  assert(approved, "Safe has not approved the parent-bound registrar");
  assert(
    observedSafeThreshold === safeThreshold,
    "Safe threshold does not match the approved value",
  );
  assert(
    sameAddressSet(observedSafeOwners, safeOwners),
    "Safe owners do not match the approved set",
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        adapterApproval: true,
        checkedAt: new Date().toISOString(),
        chainId: sepolia.id,
        parentExpiry: new Date(Number(parentData[2]) * 1000).toISOString(),
        parentName,
        registrarAddress,
        registrarCodeHash,
        safeAddress,
        safeOwnerCount: observedSafeOwners.length,
        safeThreshold: Number(observedSafeThreshold),
        signerAddress,
        status: "verified",
      },
      null,
      2,
    )}\n`,
  );
};

run().catch((error) => {
  process.stderr.write(
    `ENS deployment verification failed: ${
      error instanceof VerificationError
        ? error.message
        : "an RPC or contract read failed"
    }\n`,
  );
  process.exitCode = 1;
});
