import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  keccak256,
  namehash,
  stringToHex,
  type Address,
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

import { getEnsConfig } from "./config";
import { PartnerIntegrationError } from "./errors";

const institutionalEnsAdapterAbi = [
  {
    type: "function",
    name: "setSubname",
    stateMutability: "nonpayable",
    inputs: [
      { name: "parentNode", type: "bytes32" },
      { name: "labelHash", type: "bytes32" },
      { name: "owner", type: "address" },
      { name: "idempotencyKey", type: "bytes32" },
    ],
    outputs: [{ name: "node", type: "bytes32" }],
  },
] as const;

const MAX_ISSUANCE_GAS_COST_WEI = BigInt("10000000000000000");

export const buildEnsSubname = (label: string, parentName: string): string => {
  const normalizedLabel = normalizeEnsName(label);
  if (
    normalizedLabel.includes(".") ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(normalizedLabel)
  ) {
    throw new PartnerIntegrationError(
      "invalid-request",
      "Choose one ENS label using letters, numbers, or internal hyphens.",
    );
  }
  return normalizeEnsName(`${normalizedLabel}.${parentName}`);
};

interface EnsDriver {
  issue(input: {
    readonly idempotencyKey: string;
    readonly label: string;
    readonly owner: Address;
    readonly parentName: string;
  }): Promise<{ readonly hash: Hex; readonly resolvedAddress: Address | null }>;
  reverseResolve(address: Address): Promise<string | null>;
}

const createViemEnsDriver = (): EnsDriver => {
  const config = getEnsConfig();
  const account = privateKeyToAccount(config.signerPrivateKey as Hex);
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(config.rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(config.rpcUrl),
  });

  return {
    async issue({ idempotencyKey, label, owner, parentName }) {
      const args = [
        namehash(parentName),
        keccak256(stringToHex(label)),
        owner,
        keccak256(stringToHex(idempotencyKey)),
      ] as const;
      const contract = {
        abi: institutionalEnsAdapterAbi,
        address: getAddress(config.registrarAddress),
        account,
        args,
        functionName: "setSubname" as const,
      };
      const [gas, fees] = await Promise.all([
        publicClient.estimateContractGas(contract),
        publicClient.estimateFeesPerGas(),
      ]);
      if (gas * fees.maxFeePerGas > MAX_ISSUANCE_GAS_COST_WEI) {
        throw new PartnerIntegrationError(
          "authorization",
          "ENS issuance exceeded the institutional gas safety limit.",
        );
      }
      const { request } = await publicClient.simulateContract({
        ...contract,
        gas,
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      });
      const hash = await walletClient.writeContract(request);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });
      if (receipt.status !== "success") {
        throw new PartnerIntegrationError(
          "invalid-response",
          "ENS subname issuance did not confirm.",
        );
      }
      const resolvedAddress = await publicClient.getEnsAddress({
        name: `${label}.${parentName}`,
      });
      return { hash, resolvedAddress };
    },
    reverseResolve: (address) => publicClient.getEnsName({ address }),
  };
};

export class SepoliaEnsNameProvider implements NameProvider {
  readonly capability = {
    name: "ens" as const,
    status: "available" as const,
    label: "ENS subnames",
    detail:
      "Ethereum Sepolia ENS resolution and subname issuance are configured.",
  };

  constructor(private readonly driver: EnsDriver = createViemEnsDriver()) {}

  async issueSubname(input: {
    readonly idempotencyKey: string;
    readonly label: string;
    readonly walletAddress: `0x${string}`;
  }) {
    const config = getEnsConfig();
    const name = buildEnsSubname(input.label, config.parentName);
    const label = name.slice(0, -(config.parentName.length + 1));
    const walletAddress = getAddress(input.walletAddress);
    const result = await this.driver.issue({
      idempotencyKey: input.idempotencyKey,
      label,
      owner: walletAddress,
      parentName: config.parentName,
    });
    if (
      !result.resolvedAddress ||
      getAddress(result.resolvedAddress) !== walletAddress
    ) {
      throw new PartnerIntegrationError(
        "integrity",
        "The issued ENS name did not resolve to the verified wallet.",
      );
    }
    return { name, transactionHash: result.hash };
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
