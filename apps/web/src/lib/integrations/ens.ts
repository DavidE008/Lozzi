import "server-only";

import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  keccak256,
  namehash,
  stringToHex,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import {
  ensResolutionSchema,
  normalizeEnsName,
  type EnsResolution,
  type NameProvider,
} from "@lozzi/domain";

import { getEnsConfig, type EnsConfig } from "./config";
import { PartnerIntegrationError } from "./errors";

const ENS_REGISTRY = getAddress("0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e");
const ENS_NAME_WRAPPER = getAddress("0x0635513f179D50A207757E05759CbD106d7dFcE8");
const ENS_PUBLIC_RESOLVER = getAddress(
  "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5",
);
const ENS_UNIVERSAL_RESOLVER = getAddress(
  "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe",
);
const MINIMUM_PARENT_LIFETIME_SECONDS = BigInt(30 * 24 * 60 * 60);

const institutionalEnsRegistrarAbi = [
  {
    type: "function",
    name: "issue",
    stateMutability: "nonpayable",
    inputs: [
      { name: "label", type: "string" },
      { name: "resolvedAddress", type: "address" },
      { name: "requestKey", type: "bytes32" },
    ],
    outputs: [{ name: "node", type: "bytes32" }],
  },
  {
    type: "function",
    name: "ensRegistry",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "issuer",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "nameWrapper",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "parentNode",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "publicResolver",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "event",
    name: "SubnameIssued",
    inputs: [
      { indexed: true, name: "requestKey", type: "bytes32" },
      { indexed: true, name: "labelHash", type: "bytes32" },
      { indexed: true, name: "resolvedAddress", type: "address" },
      { indexed: false, name: "node", type: "bytes32" },
    ],
  },
] as const;

const ensRegistryAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "resolver",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const nameWrapperAbi = [
  {
    type: "function",
    name: "getData",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "fuses", type: "uint32" },
      { name: "expiry", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const safeAbi = [
  {
    type: "function",
    name: "getOwners",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "getThreshold",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const buildEnsSubname = (label: string, parentName: string): string => {
  const normalizedLabel = normalizeEnsName(label);
  if (
    normalizedLabel.includes(".") ||
    normalizedLabel.length < 3 ||
    normalizedLabel.length > 32 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(normalizedLabel)
  ) {
    throw new PartnerIntegrationError(
      "invalid-request",
      "Choose one 3-32 character ENS label using lowercase letters, numbers, or single internal hyphens.",
    );
  }
  return normalizeEnsName(`${normalizedLabel}.${parentName}`);
};

interface EnsSigner {
  readonly address: Address;
  getChainId(): Promise<number>;
  write(input: {
    readonly gas: bigint;
    readonly label: string;
    readonly maxFeePerGas: bigint;
    readonly maxPriorityFeePerGas: bigint;
    readonly registrarAddress: Address;
    readonly requestKey: Hex;
    readonly resolvedAddress: Address;
  }): Promise<Hash>;
}

const createEnsSigner = (config: EnsConfig): EnsSigner => {
  if (config.signer.type === "local-private-key") {
    const account = privateKeyToAccount(config.signer.privateKey as Hex);
    const client = createWalletClient({
      account,
      chain: sepolia,
      transport: http(config.writeRpcUrl),
    });
    return {
      address: account.address,
      getChainId: () => client.getChainId(),
      write: (input) =>
        client.writeContract({
          abi: institutionalEnsRegistrarAbi,
          account,
          address: input.registrarAddress,
          args: [input.label, input.resolvedAddress, input.requestKey],
          functionName: "issue",
          gas: input.gas,
          maxFeePerGas: input.maxFeePerGas,
          maxPriorityFeePerGas: input.maxPriorityFeePerGas,
        }),
    };
  }

  const account = getAddress(config.signer.address);
  const client = createWalletClient({
    account,
    chain: sepolia,
    transport: http(config.signer.rpcUrl),
  });
  return {
    address: account,
    getChainId: () => client.getChainId(),
    write: (input) =>
      client.writeContract({
        abi: institutionalEnsRegistrarAbi,
        account,
        address: input.registrarAddress,
        args: [input.label, input.resolvedAddress, input.requestKey],
        functionName: "issue",
        gas: input.gas,
        maxFeePerGas: input.maxFeePerGas,
        maxPriorityFeePerGas: input.maxPriorityFeePerGas,
      }),
  };
};

export interface EnsSubmission {
  readonly name: string;
  readonly transactionHash: Hash;
}

export interface EnsConfirmation {
  readonly confirmationCount: number;
  readonly confirmedAt: string;
  readonly confirmedBlockNumber: bigint;
  readonly resolvedAddress: Address;
  readonly resolverAddress: Address;
}

interface EnsDriver {
  confirm(input: {
    readonly name: string;
    readonly requestKey: Hex;
    readonly transactionHash: Hash;
    readonly walletAddress: Address;
  }): Promise<EnsConfirmation>;
  findSubmission(input: {
    readonly requestKey: Hex;
    readonly walletAddress: Address;
  }): Promise<Hash | null>;
  reverseResolve(address: Address): Promise<string | null>;
  submit(input: {
    readonly label: string;
    readonly requestKey: Hex;
    readonly walletAddress: Address;
  }): Promise<EnsSubmission>;
}

const requireCode = (code: Hex | undefined, expectedHash?: Hex): void => {
  if (!code || code === "0x") {
    throw new PartnerIntegrationError(
      "integrity",
      "A required ENS contract has no bytecode on Sepolia.",
    );
  }
  if (expectedHash && keccak256(code).toLowerCase() !== expectedHash.toLowerCase()) {
    throw new PartnerIntegrationError(
      "integrity",
      "The ENS registrar bytecode does not match the approved deployment.",
    );
  }
};

const createViemEnsDriver = (): EnsDriver => {
  const config = getEnsConfig();
  const registrarAddress = getAddress(config.registrarAddress);
  const safeAddress = getAddress(config.safeAddress);
  const signer = createEnsSigner(config);
  const writeClient = createPublicClient({
    chain: sepolia,
    transport: http(config.writeRpcUrl),
  });
  const readClient = createPublicClient({
    chain: sepolia,
    transport: http(config.readRpcUrl),
  });

  const preflight = async (input: {
    readonly label: string;
    readonly requestKey: Hex;
    readonly walletAddress: Address;
  }) => {
    const parentNode = namehash(config.parentName);
    const labelHash = keccak256(stringToHex(input.label));
    const childNode = keccak256(
      `0x${parentNode.slice(2)}${labelHash.slice(2)}` as Hex,
    );
    const [
      writeChainId,
      readChainId,
      signerChainId,
      writeRegistrarCode,
      readRegistrarCode,
      registryCode,
      wrapperCode,
      resolverCode,
      universalResolverCode,
      safeCode,
      safeOwners,
      safeThreshold,
      configuredParentNode,
      configuredRegistry,
      configuredWrapper,
      configuredResolver,
      configuredOwner,
      configuredIssuer,
      paused,
      registryParentOwner,
      parentData,
      adapterApproved,
      childData,
    ] = await Promise.all([
      writeClient.getChainId(),
      readClient.getChainId(),
      signer.getChainId(),
      writeClient.getCode({ address: registrarAddress }),
      readClient.getCode({ address: registrarAddress }),
      readClient.getCode({ address: ENS_REGISTRY }),
      readClient.getCode({ address: ENS_NAME_WRAPPER }),
      readClient.getCode({ address: ENS_PUBLIC_RESOLVER }),
      readClient.getCode({ address: ENS_UNIVERSAL_RESOLVER }),
      readClient.getCode({ address: safeAddress }),
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
      readClient.readContract({
        abi: institutionalEnsRegistrarAbi,
        address: registrarAddress,
        functionName: "parentNode",
      }),
      readClient.readContract({
        abi: institutionalEnsRegistrarAbi,
        address: registrarAddress,
        functionName: "ensRegistry",
      }),
      readClient.readContract({
        abi: institutionalEnsRegistrarAbi,
        address: registrarAddress,
        functionName: "nameWrapper",
      }),
      readClient.readContract({
        abi: institutionalEnsRegistrarAbi,
        address: registrarAddress,
        functionName: "publicResolver",
      }),
      readClient.readContract({
        abi: institutionalEnsRegistrarAbi,
        address: registrarAddress,
        functionName: "owner",
      }),
      readClient.readContract({
        abi: institutionalEnsRegistrarAbi,
        address: registrarAddress,
        functionName: "issuer",
      }),
      readClient.readContract({
        abi: institutionalEnsRegistrarAbi,
        address: registrarAddress,
        functionName: "paused",
      }),
      readClient.readContract({
        abi: ensRegistryAbi,
        address: ENS_REGISTRY,
        args: [parentNode],
        functionName: "owner",
      }),
      readClient.readContract({
        abi: nameWrapperAbi,
        address: ENS_NAME_WRAPPER,
        args: [BigInt(parentNode)],
        functionName: "getData",
      }),
      readClient.readContract({
        abi: nameWrapperAbi,
        address: ENS_NAME_WRAPPER,
        args: [safeAddress, registrarAddress],
        functionName: "isApprovedForAll",
      }),
      readClient.readContract({
        abi: nameWrapperAbi,
        address: ENS_NAME_WRAPPER,
        args: [BigInt(childNode)],
        functionName: "getData",
      }),
    ]);

    if (
      writeChainId !== sepolia.id ||
      readChainId !== sepolia.id ||
      signerChainId !== sepolia.id
    ) {
      throw new PartnerIntegrationError(
        "integrity",
        "All ENS RPC and signer connections must report Ethereum Sepolia.",
      );
    }
    requireCode(writeRegistrarCode, config.registrarCodeHash as Hex);
    requireCode(readRegistrarCode, config.registrarCodeHash as Hex);
    [registryCode, wrapperCode, resolverCode, universalResolverCode, safeCode].forEach(
      (code) => requireCode(code),
    );

    const [wrappedParentOwner,, parentExpiry] = parentData;
    const [childOwner] = childData;
    const minimumExpiry =
      BigInt(Math.floor(Date.now() / 1000)) + MINIMUM_PARENT_LIFETIME_SECONDS;
    const expectedSafeOwners = new Set(
      config.safeOwners.map((address) => getAddress(address).toLowerCase()),
    );
    const observedSafeOwners = new Set(
      safeOwners.map((address) => getAddress(address).toLowerCase()),
    );
    const safeConfigurationMatches =
      safeThreshold === BigInt(config.safeThreshold) &&
      observedSafeOwners.size === expectedSafeOwners.size &&
      [...expectedSafeOwners].every((address) =>
        observedSafeOwners.has(address),
      );
    if (
      configuredParentNode !== parentNode ||
      getAddress(configuredRegistry) !== ENS_REGISTRY ||
      getAddress(configuredWrapper) !== ENS_NAME_WRAPPER ||
      getAddress(configuredResolver) !== ENS_PUBLIC_RESOLVER ||
      getAddress(configuredOwner) !== safeAddress ||
      getAddress(configuredIssuer) !== signer.address ||
      !safeConfigurationMatches ||
      paused ||
      getAddress(registryParentOwner) !== ENS_NAME_WRAPPER ||
      getAddress(wrappedParentOwner) !== safeAddress ||
      !adapterApproved ||
      parentExpiry < minimumExpiry ||
      childOwner !== "0x0000000000000000000000000000000000000000"
    ) {
      throw new PartnerIntegrationError(
        "authorization",
        "ENS parent ownership, adapter authority, expiry, or label availability failed preflight.",
      );
    }

    const contract = {
      abi: institutionalEnsRegistrarAbi,
      account: signer.address,
      address: registrarAddress,
      args: [input.label, input.walletAddress, input.requestKey] as const,
      functionName: "issue" as const,
    };
    const [gas, fees, signerBalance] = await Promise.all([
      writeClient.estimateContractGas(contract),
      writeClient.estimateFeesPerGas(),
      writeClient.getBalance({ address: signer.address }),
    ]);
    const maximumCost = gas * fees.maxFeePerGas;
    if (
      gas > config.maxGas ||
      maximumCost > config.maxFeeWei ||
      signerBalance < maximumCost
    ) {
      throw new PartnerIntegrationError(
        "authorization",
        "ENS issuance exceeded its gas, fee, or signer-balance safety limit.",
      );
    }
    await writeClient.simulateContract({
      ...contract,
      gas,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    });
    return {
      gas,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    };
  };

  return {
    async submit({ label, requestKey, walletAddress }) {
      const name = buildEnsSubname(label, config.parentName);
      const normalizedLabel = name.slice(0, -(config.parentName.length + 1));
      const transaction = await preflight({
        label: normalizedLabel,
        requestKey,
        walletAddress,
      });
      const transactionHash = await signer.write({
        ...transaction,
        label: normalizedLabel,
        registrarAddress,
        requestKey,
        resolvedAddress: walletAddress,
      });
      return { name, transactionHash };
    },

    async confirm({ name, requestKey, transactionHash, walletAddress }) {
      const receipt = await readClient.waitForTransactionReceipt({
        confirmations: config.confirmations,
        hash: transactionHash,
        timeout: 180_000,
      });
      if (receipt.status !== "success") {
        throw new PartnerIntegrationError(
          "invalid-response",
          "ENS subname issuance reverted on Sepolia.",
        );
      }
      const [currentBlock, events, resolvedAddress, resolverAddress, code] =
        await Promise.all([
          readClient.getBlockNumber(),
          readClient.getContractEvents({
            abi: institutionalEnsRegistrarAbi,
            address: registrarAddress,
            args: { requestKey },
            eventName: "SubnameIssued",
            fromBlock: receipt.blockNumber,
            strict: true,
            toBlock: receipt.blockNumber,
          }),
          readClient.getEnsAddress({
            name,
            universalResolverAddress: ENS_UNIVERSAL_RESOLVER,
          }),
          readClient.readContract({
            abi: ensRegistryAbi,
            address: ENS_REGISTRY,
            args: [namehash(name)],
            functionName: "resolver",
          }),
          readClient.getCode({ address: registrarAddress }),
        ]);
      requireCode(code, config.registrarCodeHash as Hex);
      const matchingEvents = events.filter(
        (event) =>
          event.transactionHash === transactionHash &&
          event.args.resolvedAddress &&
          getAddress(event.args.resolvedAddress) === walletAddress,
      );
      if (
        matchingEvents.length !== 1 ||
        !resolvedAddress ||
        getAddress(resolvedAddress) !== walletAddress ||
        getAddress(resolverAddress) !== ENS_PUBLIC_RESOLVER
      ) {
        throw new PartnerIntegrationError(
          "integrity",
          "The confirmed ENS event or independent forward resolution did not match the reservation.",
        );
      }
      return {
        confirmationCount: Number(currentBlock - receipt.blockNumber + BigInt(1)),
        confirmedAt: new Date().toISOString(),
        confirmedBlockNumber: receipt.blockNumber,
        resolvedAddress: getAddress(resolvedAddress),
        resolverAddress: getAddress(resolverAddress),
      };
    },

    async findSubmission({ requestKey, walletAddress }) {
      const events = await readClient.getContractEvents({
        abi: institutionalEnsRegistrarAbi,
        address: registrarAddress,
        args: { requestKey },
        eventName: "SubnameIssued",
        fromBlock: config.deploymentBlock,
        strict: true,
        toBlock: "latest",
      });
      const matching = events.filter(
        (event) =>
          event.args.resolvedAddress &&
          getAddress(event.args.resolvedAddress) === walletAddress,
      );
      if (matching.length > 1) {
        throw new PartnerIntegrationError(
          "integrity",
          "Multiple ENS issuance events used the same request key.",
        );
      }
      return matching[0]?.transactionHash ?? null;
    },

    reverseResolve: (address) => readClient.getEnsName({ address }),
  };
};

export class SepoliaEnsNameProvider implements NameProvider {
  readonly capability = {
    name: "ens" as const,
    status: "available" as const,
    label: "ENS subnames",
    detail:
      "Durable Ethereum Sepolia ENS issuance and independent resolution are configured.",
  };

  constructor(private readonly driver: EnsDriver = createViemEnsDriver()) {}

  async submitSubname(input: {
    readonly label: string;
    readonly requestKey: Hex;
    readonly walletAddress: `0x${string}`;
  }): Promise<EnsSubmission> {
    return this.driver.submit({
      label: input.label,
      requestKey: input.requestKey,
      walletAddress: getAddress(input.walletAddress),
    });
  }

  async confirmSubname(input: {
    readonly name: string;
    readonly requestKey: Hex;
    readonly transactionHash: Hash;
    readonly walletAddress: `0x${string}`;
  }): Promise<EnsConfirmation> {
    return this.driver.confirm({
      ...input,
      walletAddress: getAddress(input.walletAddress),
    });
  }

  async findSubmission(input: {
    readonly requestKey: Hex;
    readonly walletAddress: `0x${string}`;
  }): Promise<Hash | null> {
    return this.driver.findSubmission({
      requestKey: input.requestKey,
      walletAddress: getAddress(input.walletAddress),
    });
  }

  async issueSubname(input: {
    readonly idempotencyKey: string;
    readonly label: string;
    readonly walletAddress: `0x${string}`;
  }) {
    const requestKey = /^0x[0-9a-fA-F]{64}$/u.test(input.idempotencyKey)
      ? (input.idempotencyKey as Hex)
      : keccak256(stringToHex(input.idempotencyKey));
    const submitted = await this.submitSubname({
      label: input.label,
      requestKey,
      walletAddress: input.walletAddress,
    });
    await this.confirmSubname({
      name: submitted.name,
      requestKey,
      transactionHash: submitted.transactionHash,
      walletAddress: input.walletAddress,
    });
    return {
      name: submitted.name,
      transactionHash: submitted.transactionHash,
    };
  }

  async resolveAddress(walletAddress: `0x${string}`): Promise<EnsResolution> {
    const name = await this.driver.reverseResolve(getAddress(walletAddress));
    return ensResolutionSchema.parse({
      address: getAddress(walletAddress),
      name: name ? normalizeEnsName(name) : null,
      network: "ethereum-sepolia",
      resolvedAt: new Date().toISOString(),
    });
  }
}

export const createEnsNameProvider = () => new SepoliaEnsNameProvider();

export const verifyEnsForwardResolutionCleared = async (
  name: string,
): Promise<boolean> => {
  const config = getEnsConfig();
  const normalizedName = normalizeEnsName(name);
  const expectedSuffix = `.${normalizeEnsName(config.parentName)}`;
  if (!normalizedName.endsWith(expectedSuffix)) {
    throw new PartnerIntegrationError(
      "integrity",
      "The ENS revocation target is outside the configured parent.",
    );
  }
  const registrarAddress = getAddress(config.registrarAddress);
  const client = createPublicClient({
    chain: sepolia,
    transport: http(config.readRpcUrl),
  });
  const [chainId, code, resolvedAddress] = await Promise.all([
    client.getChainId(),
    client.getCode({ address: registrarAddress }),
    client.getEnsAddress({
      name: normalizedName,
      universalResolverAddress: ENS_UNIVERSAL_RESOLVER,
    }),
  ]);
  if (chainId !== sepolia.id) {
    throw new PartnerIntegrationError(
      "integrity",
      "The ENS confirmation RPC is not Ethereum Sepolia.",
    );
  }
  requireCode(code, config.registrarCodeHash as Hex);
  return resolvedAddress === null;
};
