import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  keccak256,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";

import type { RegistryAdapterConfig } from "./config";
import {
  academicRecordRegistryAbi,
  type PreparedRegistryTransaction,
  type RegistryCommand,
  type RegistryPublicClient,
  WorldChainRegistryAdapter,
} from "./registry-adapter";

const institutionRegistryAddress = getAddress(`0x${"11".repeat(20)}`);
const academicRecordRegistryAddress = getAddress(`0x${"12".repeat(20)}`);
const relayerAddress = getAddress(`0x${"13".repeat(20)}`);
const institutionCommitment = `0x${"a1".repeat(32)}` as const;
const studentCommitment = `0x${"b1".repeat(32)}` as const;
const recordVersionCommitment = `0x${"c1".repeat(32)}` as const;
const grantCommitment = `0x${"d1".repeat(32)}` as const;
const zeroBytes32 = `0x${"00".repeat(32)}` as const;
const transactionHash = `0x${"e1".repeat(32)}` as const;
const shareExpiresAt = "2026-07-26T04:00:00.000Z";
const institutionRuntimeCode = "0x6001600055" as const;
const recordRuntimeCode = "0x6002600055" as const;

const anchorCommand: RegistryCommand = {
  idempotencyKey: "93000000-0000-4000-8000-000000000701",
  institutionCommitment,
  kind: "anchor-record",
  recordVersionCommitment,
  studentCommitment,
};

const createShareCommand: RegistryCommand = {
  expiresAt: shareExpiresAt,
  grantCommitment,
  idempotencyKey: "93000000-0000-4000-8000-000000000702",
  institutionCommitment,
  kind: "create-share",
  recordVersionCommitment,
  studentCommitment,
};

const revokeShareCommand: RegistryCommand = {
  grantCommitment,
  idempotencyKey: "93000000-0000-4000-8000-000000000703",
  institutionCommitment,
  kind: "revoke-share",
};

const registryConfig = (
  overrides: Partial<RegistryAdapterConfig> = {},
): RegistryAdapterConfig => ({
  academicRecordRegistryAddress,
  academicRecordRegistryCodeHash: keccak256(recordRuntimeCode),
  chainId: 4801,
  confirmations: 3,
  independentRpcUrl: "https://independent.example",
  institutionRegistryAddress,
  institutionRegistryCodeHash: keccak256(institutionRuntimeCode),
  maxGas: BigInt(800_000),
  mode: "simulation-only",
  primaryRpcUrl: "https://primary.example",
  relayerAddress,
  ...overrides,
});

class FakeRegistryClient implements RegistryPublicClient {
  chainId = 4801;
  currentBlock = BigInt(102);
  currentRecordVersion: Hex = zeroBytes32;
  institutionActive = true;
  institutionCode: Hex | undefined = institutionRuntimeCode;
  institutionRegistry: Address = institutionRegistryAddress;
  recordCode: Hex | undefined = recordRuntimeCode;
  recordVersion: readonly [Hex, Hex, bigint] = [
    studentCommitment,
    zeroBytes32,
    BigInt(1),
  ];
  receipt: {
    blockNumber: bigint;
    logs: readonly unknown[];
    status: "success" | "reverted";
    to: Address | null;
    transactionHash: Hash;
  } = {
    blockNumber: BigInt(100),
    logs: [],
    status: "success",
    to: academicRecordRegistryAddress,
    transactionHash,
  };
  relayerAuthorized = true;
  shareGrant: readonly [boolean, Hex, Hex, bigint, boolean] = [
    true,
    studentCommitment,
    recordVersionCommitment,
    BigInt(Math.floor(new Date(shareExpiresAt).getTime() / 1_000)),
    false,
  ];
  simulationError: Error | null = null;
  simulationRequestData: Hex | undefined;

  async estimateContractGas() {
    return BigInt(250_000);
  }

  async getBlockNumber() {
    return this.currentBlock;
  }

  async getChainId() {
    return this.chainId;
  }

  async getCode(input: { address: Address }) {
    return input.address === institutionRegistryAddress
      ? this.institutionCode
      : this.recordCode;
  }

  async getTransactionReceipt() {
    return this.receipt;
  }

  async readContract(input: Readonly<Record<string, unknown>>) {
    switch (input.functionName) {
      case "institutionRegistry":
        return this.institutionRegistry;
      case "isInstitutionActive":
        return this.institutionActive;
      case "isAuthorizedSigner":
        return this.relayerAuthorized;
      case "currentRecordVersion":
        return this.currentRecordVersion;
      case "getRecordVersion":
        return this.recordVersion;
      case "verifyShareGrant":
        return this.shareGrant;
      default:
        throw new Error(`Unexpected function ${String(input.functionName)}`);
    }
  }

  async simulateContract() {
    if (this.simulationError) throw this.simulationError;
    return {
      request: {
        data: this.simulationRequestData,
      },
    };
  }
}

const adapterFixture = (
  configOverrides: Partial<RegistryAdapterConfig> = {},
) => {
  const primary = new FakeRegistryClient();
  const independent = new FakeRegistryClient();
  const adapter = new WorldChainRegistryAdapter(
    registryConfig(configOverrides),
    { independent, primary },
  );
  return { adapter, independent, primary };
};

const recordPublishedLog = (
  previousVersionCommitment: Hex = zeroBytes32,
) => ({
  address: academicRecordRegistryAddress,
  data: encodeAbiParameters(
    [{ name: "previousVersionCommitment", type: "bytes32" }],
    [previousVersionCommitment],
  ),
  topics: encodeEventTopics({
    abi: academicRecordRegistryAbi,
    args: {
      institutionId: institutionCommitment,
      studentCommitment,
      versionCommitment: recordVersionCommitment,
    },
    eventName: "RecordVersionPublished",
  }),
});

const prepareAnchor = async (
  fixture = adapterFixture(),
): Promise<
  ReturnType<typeof adapterFixture> & {
    prepared: PreparedRegistryTransaction;
  }
> => ({
  ...fixture,
  prepared: await fixture.adapter.prepare(anchorCommand),
});

describe("World Chain registry adapter", () => {
  it("keeps all transaction preparation disabled by default mode", async () => {
    const { adapter, primary } = adapterFixture({
      mode: "transactions-disabled",
    });

    await expect(adapter.prepare(anchorCommand)).rejects.toThrow(
      /transaction preparation is disabled/u,
    );
    expect(primary.simulationRequestData).toBeUndefined();
  });

  it.each([
    [anchorCommand, "publishRecordVersion"],
    [createShareCommand, "createShareGrant"],
    [revokeShareCommand, "revokeShareGrant"],
  ] as const)(
    "simulates and prepares commitment-only %s calldata",
    async (command, expectedFunction) => {
      const { adapter } = adapterFixture();
      const prepared = await adapter.prepare(command);
      const decoded = decodeFunctionData({
        abi: academicRecordRegistryAbi,
        data: prepared.data,
      });

      expect(prepared).toMatchObject({
        account: relayerAddress,
        chainId: 4801,
        functionName: expectedFunction,
        gas: BigInt(250_000),
        mode: "simulation-only",
        to: academicRecordRegistryAddress,
        value: BigInt(0),
      });
      expect(decoded.functionName).toBe(expectedFunction);
      expect(prepared.calldataHash).toBe(keccak256(prepared.data));
    },
  );

  it("classifies a simulation revert without preparing a transaction", async () => {
    const { adapter, primary } = adapterFixture();
    primary.simulationError = new Error("synthetic contract revert");

    await expect(adapter.prepare(anchorCommand)).rejects.toThrow(
      /simulation was rejected/u,
    );
  });

  it("rejects wrong-chain primary or independent RPCs", async () => {
    const { adapter, independent } = adapterFixture();
    independent.chainId = 4802;

    await expect(adapter.prepare(anchorCommand)).rejects.toThrow(
      /wrong chain ID/u,
    );
  });

  it("rejects missing or mismatched deployed bytecode", async () => {
    const missing = adapterFixture();
    missing.primary.recordCode = "0x";
    await expect(missing.adapter.prepare(anchorCommand)).rejects.toThrow(
      /no runtime bytecode/u,
    );

    const mismatch = adapterFixture({
      academicRecordRegistryCodeHash: `0x${"ff".repeat(32)}`,
    });
    await expect(mismatch.adapter.prepare(anchorCommand)).rejects.toThrow(
      /bytecode is not approved/u,
    );
  });

  it("rejects independent current-version disagreement", async () => {
    const { adapter, independent } = adapterFixture();
    independent.currentRecordVersion = `0x${"77".repeat(32)}`;

    await expect(adapter.prepare(anchorCommand)).rejects.toThrow(
      /disagree about the current record version/u,
    );
  });

  it("fails closed when the managed relayer lacks scoped authorization", async () => {
    const { adapter, primary } = adapterFixture();
    primary.relayerAuthorized = false;

    await expect(adapter.prepare(anchorCommand)).rejects.toThrow(
      /relayer authorization is unavailable/u,
    );
  });

  it("independently verifies a reconciled share grant without preparing a write", async () => {
    const { adapter } = adapterFixture();
    const databaseExpiry = shareExpiresAt.replace("Z", "+00:00");

    await expect(
      adapter.verifyShareGrant({
        expiresAt: databaseExpiry,
        grantCommitment,
        institutionCommitment,
        recordCommitment: recordVersionCommitment,
        studentCommitment,
      }),
    ).resolves.toEqual({
      expiresAt: databaseExpiry,
      status: "chain-confirmed",
    });
  });

  it("rejects an independently inconsistent share grant readback", async () => {
    const { adapter, independent } = adapterFixture();
    independent.shareGrant = [
      true,
      studentCommitment,
      recordVersionCommitment,
      BigInt(Math.floor(new Date(shareExpiresAt).getTime() / 1_000)),
      true,
    ];

    await expect(
      adapter.verifyShareGrant({
        expiresAt: shareExpiresAt,
        grantCommitment,
        institutionCommitment,
        recordCommitment: recordVersionCommitment,
        studentCommitment,
      }),
    ).rejects.toThrow(/did not confirm the expected share grant/u);
  });

  it("rejects malformed, reverted, or event-mismatched receipts", async () => {
    const malformed = await prepareAnchor();
    await expect(
      malformed.adapter.inspectReceipt(malformed.prepared, transactionHash),
    ).rejects.toThrow(/receipt or emitted event did not match/u);

    const reverted = await prepareAnchor();
    reverted.primary.receipt = {
      ...reverted.primary.receipt,
      logs: [recordPublishedLog()],
      status: "reverted",
    };
    await expect(
      reverted.adapter.inspectReceipt(reverted.prepared, transactionHash),
    ).rejects.toThrow(/receipt or emitted event did not match/u);

    const mismatch = await prepareAnchor();
    mismatch.primary.receipt = {
      ...mismatch.primary.receipt,
      logs: [recordPublishedLog(`0x${"88".repeat(32)}`)],
    };
    await expect(
      mismatch.adapter.inspectReceipt(mismatch.prepared, transactionHash),
    ).rejects.toThrow(/receipt or emitted event did not match/u);
  });

  it("reports confirmation progression before independent readback", async () => {
    const fixture = await prepareAnchor();
    fixture.primary.currentBlock = BigInt(100);
    fixture.primary.receipt = {
      ...fixture.primary.receipt,
      logs: [recordPublishedLog()],
    };

    await expect(
      fixture.adapter.inspectReceipt(fixture.prepared, transactionHash),
    ).resolves.toMatchObject({
      confirmationCount: 1,
      expectedConfirmations: 3,
      status: "confirmation-pending",
    });
  });

  it("reconciles a confirmed event through primary and independent readback", async () => {
    const fixture = await prepareAnchor();
    fixture.primary.receipt = {
      ...fixture.primary.receipt,
      logs: [recordPublishedLog()],
    };
    fixture.primary.currentRecordVersion = recordVersionCommitment;
    fixture.independent.currentRecordVersion = recordVersionCommitment;

    await expect(
      fixture.adapter.inspectReceipt(fixture.prepared, transactionHash),
    ).resolves.toMatchObject({
      confirmationCount: 3,
      status: "reconciled",
    });
  });

  it("rejects an independent readback mismatch after confirmation", async () => {
    const fixture = await prepareAnchor();
    fixture.primary.receipt = {
      ...fixture.primary.receipt,
      logs: [recordPublishedLog()],
    };
    fixture.primary.currentRecordVersion = recordVersionCommitment;
    fixture.independent.currentRecordVersion = recordVersionCommitment;
    fixture.independent.recordVersion = [
      `0x${"99".repeat(32)}`,
      zeroBytes32,
      BigInt(1),
    ];

    await expect(
      fixture.adapter.inspectReceipt(fixture.prepared, transactionHash),
    ).rejects.toThrow(/Independent registry record readback/u);
  });

  it("rejects tampered prepared transaction metadata", async () => {
    const fixture = await prepareAnchor();
    const tampered = {
      ...fixture.prepared,
      calldataHash: `0x${"01".repeat(32)}` as Hash,
    };

    await expect(
      fixture.adapter.inspectReceipt(tampered, transactionHash),
    ).rejects.toThrow(/metadata is inconsistent/u);
  });
});
