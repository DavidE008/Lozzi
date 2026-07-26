import "server-only";

import {
  createPublicClient,
  decodeFunctionData,
  encodeFunctionData,
  getAddress,
  http,
  keccak256,
  parseAbi,
  parseEventLogs,
  stringToHex,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { z } from "zod";

import {
  getRegistryAdapterConfig,
  type RegistryAdapterConfig,
} from "./config";
import { PartnerIntegrationError } from "./errors";

export const institutionRegistryAbi = parseAbi([
  "function isInstitutionActive(bytes32 institutionId) view returns (bool)",
  "function isAuthorizedSigner(bytes32 institutionId, address account) view returns (bool)",
]);

export const academicRecordRegistryAbi = parseAbi([
  "function institutionRegistry() view returns (address)",
  "function currentRecordVersion(bytes32 institutionId, bytes32 studentCommitment) view returns (bytes32)",
  "function getRecordVersion(bytes32 institutionId, bytes32 versionCommitment) view returns (bytes32 studentCommitment, bytes32 previousVersionCommitment, uint64 publishedAt)",
  "function verifyShareGrant(bytes32 institutionId, bytes32 grantCommitment) view returns (bool valid, bytes32 studentCommitment, bytes32 recordVersionCommitment, uint64 expiresAt, bool revoked)",
  "function publishRecordVersion(bytes32 institutionId, bytes32 studentCommitment, bytes32 versionCommitment, bytes32 previousVersionCommitment, bytes32 idempotencyKey)",
  "function createShareGrant(bytes32 institutionId, bytes32 studentCommitment, bytes32 recordVersionCommitment, bytes32 grantCommitment, uint64 expiresAt, bytes32 idempotencyKey)",
  "function revokeShareGrant(bytes32 institutionId, bytes32 grantCommitment, bytes32 idempotencyKey)",
  "event RecordVersionPublished(bytes32 indexed institutionId, bytes32 indexed studentCommitment, bytes32 indexed versionCommitment, bytes32 previousVersionCommitment)",
  "event ShareGrantCreated(bytes32 indexed institutionId, bytes32 indexed grantCommitment, bytes32 indexed recordVersionCommitment, uint64 expiresAt)",
  "event ShareGrantRevoked(bytes32 indexed institutionId, bytes32 indexed grantCommitment)",
]);

const bytes32Schema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/u)
  .transform((value) => value.toLowerCase() as Hex);

const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(160)
  .regex(/^[A-Za-z0-9._:-]+$/u);

export const registryCommandSchema = z.discriminatedUnion("kind", [
  z
    .object({
      idempotencyKey: idempotencyKeySchema,
      institutionCommitment: bytes32Schema,
      kind: z.literal("anchor-record"),
      recordVersionCommitment: bytes32Schema,
      studentCommitment: bytes32Schema,
    })
    .strict(),
  z
    .object({
      expiresAt: z.iso.datetime(),
      grantCommitment: bytes32Schema,
      idempotencyKey: idempotencyKeySchema,
      institutionCommitment: bytes32Schema,
      kind: z.literal("create-share"),
      recordVersionCommitment: bytes32Schema,
      studentCommitment: bytes32Schema,
    })
    .strict(),
  z
    .object({
      grantCommitment: bytes32Schema,
      idempotencyKey: idempotencyKeySchema,
      institutionCommitment: bytes32Schema,
      kind: z.literal("revoke-share"),
    })
    .strict(),
]);

export type RegistryCommand = z.infer<typeof registryCommandSchema>;

type RegistryFunctionName =
  | "publishRecordVersion"
  | "createShareGrant"
  | "revokeShareGrant";

export type PreparedRegistryTransaction = Readonly<{
  account: Address;
  calldataHash: Hash;
  chainId: number;
  command: RegistryCommand;
  data: Hex;
  expectedEventFingerprint: Hash;
  functionName: RegistryFunctionName;
  gas: bigint;
  mode: "simulation-only";
  previousVersionCommitment: Hex | null;
  to: Address;
  value: bigint;
}>;

export type RegistryReconciliation = Readonly<{
  blockNumber: bigint;
  confirmationCount: number;
  expectedConfirmations: number;
  status: "confirmation-pending" | "reconciled";
  transactionHash: Hash;
}>;

export type RegistryShareVerification = Readonly<{
  expiresAt: string;
  status: "chain-confirmed";
}>;

const registryShareVerificationInputSchema = z
  .object({
    expiresAt: z.iso.datetime({ offset: true }),
    grantCommitment: bytes32Schema,
    institutionCommitment: bytes32Schema,
    recordCommitment: bytes32Schema,
    studentCommitment: bytes32Schema,
  })
  .strict();

const shareGrantReadbackSchema = z.tuple([
  z.boolean(),
  bytes32Schema,
  bytes32Schema,
  z.bigint().nonnegative(),
  z.boolean(),
]);

type RegistryReceipt = Readonly<{
  blockNumber: bigint;
  logs: readonly unknown[];
  status: "success" | "reverted";
  to: Address | null;
  transactionHash: Hash;
}>;

export interface RegistryPublicClient {
  estimateContractGas(input: Readonly<Record<string, unknown>>): Promise<bigint>;
  getBlockNumber(): Promise<bigint>;
  getChainId(): Promise<number>;
  getCode(input: { address: Address }): Promise<Hex | undefined>;
  getTransactionReceipt(input: { hash: Hash }): Promise<RegistryReceipt>;
  readContract(input: Readonly<Record<string, unknown>>): Promise<unknown>;
  simulateContract(input: Readonly<Record<string, unknown>>): Promise<unknown>;
}

type RegistryClients = Readonly<{
  independent: RegistryPublicClient;
  primary: RegistryPublicClient;
}>;

const asHex = (value: unknown, context: string): Hex => {
  const parsed = bytes32Schema.safeParse(value);
  if (!parsed.success) {
    throw new PartnerIntegrationError(
      "integrity",
      `The registry returned an invalid ${context}.`,
    );
  }
  return parsed.data;
};

const sameHex = (first: string, second: string) =>
  first.toLowerCase() === second.toLowerCase();

const asAddress = (value: unknown, context: string): Address => {
  try {
    return getAddress(String(value));
  } catch (cause) {
    throw new PartnerIntegrationError(
      "integrity",
      `The registry returned an invalid ${context}.`,
      { cause },
    );
  }
};

const operationKey = (idempotencyKey: string): Hash =>
  keccak256(
    stringToHex(`lozzi:m6:registry-operation:v1:${idempotencyKey}`),
  );

const requireRuntimeCode = (
  code: Hex | undefined,
  expectedHash: Hex,
  contractLabel: string,
) => {
  if (!code || code === "0x") {
    throw new PartnerIntegrationError(
      "integrity",
      `The configured ${contractLabel} has no runtime bytecode.`,
    );
  }
  if (!sameHex(keccak256(code), expectedHash)) {
    throw new PartnerIntegrationError(
      "integrity",
      `The configured ${contractLabel} bytecode is not approved.`,
    );
  }
};

const readContract = (
  client: RegistryPublicClient,
  address: Address,
  abi: typeof academicRecordRegistryAbi | typeof institutionRegistryAbi,
  functionName: string,
  args: readonly unknown[] = [],
) =>
  client.readContract({
    abi,
    address,
    args,
    functionName,
  });

const createClients = (config: RegistryAdapterConfig): RegistryClients => ({
  independent: createPublicClient({
    transport: http(config.independentRpcUrl),
  }) as unknown as RegistryPublicClient,
  primary: createPublicClient({
    transport: http(config.primaryRpcUrl),
  }) as unknown as RegistryPublicClient,
});

const buildCalldata = (
  command: RegistryCommand,
  previousVersionCommitment: Hex | null,
): Readonly<{
  args: readonly unknown[];
  data: Hex;
  functionName: RegistryFunctionName;
}> => {
  const key = operationKey(command.idempotencyKey);
  if (command.kind === "anchor-record") {
    const previous = previousVersionCommitment ?? (`0x${"00".repeat(32)}` as Hex);
    const args = [
      command.institutionCommitment,
      command.studentCommitment,
      command.recordVersionCommitment,
      previous,
      key,
    ] as const;
    return {
      args,
      data: encodeFunctionData({
        abi: academicRecordRegistryAbi,
        args,
        functionName: "publishRecordVersion",
      }),
      functionName: "publishRecordVersion",
    };
  }

  if (command.kind === "create-share") {
    const expiresAt = BigInt(
      Math.floor(new Date(command.expiresAt).getTime() / 1_000),
    );
    const args = [
      command.institutionCommitment,
      command.studentCommitment,
      command.recordVersionCommitment,
      command.grantCommitment,
      expiresAt,
      key,
    ] as const;
    return {
      args,
      data: encodeFunctionData({
        abi: academicRecordRegistryAbi,
        args,
        functionName: "createShareGrant",
      }),
      functionName: "createShareGrant",
    };
  }

  const args = [
    command.institutionCommitment,
    command.grantCommitment,
    key,
  ] as const;
  return {
    args,
    data: encodeFunctionData({
      abi: academicRecordRegistryAbi,
      args,
      functionName: "revokeShareGrant",
    }),
    functionName: "revokeShareGrant",
  };
};

const expectedEventFingerprint = (
  command: RegistryCommand,
  previousVersionCommitment: Hex | null,
): Hash => {
  const suffix =
    command.kind === "anchor-record"
      ? previousVersionCommitment ?? `0x${"00".repeat(32)}`
      : command.kind === "create-share"
        ? `${command.recordVersionCommitment}:${command.grantCommitment}:${command.expiresAt}`
        : command.grantCommitment;
  return keccak256(
    stringToHex(
      `lozzi:m6:expected-event:v1:${command.kind}:${command.institutionCommitment}:${suffix}`,
    ),
  );
};

const receiptEventMatches = (
  prepared: PreparedRegistryTransaction,
  receipt: RegistryReceipt,
): boolean => {
  let parsed: ReturnType<typeof parseEventLogs>;
  try {
    parsed = parseEventLogs({
      abi: academicRecordRegistryAbi,
      logs: receipt.logs as never,
      strict: true,
    });
  } catch {
    return false;
  }

  const matches = parsed.filter((entry) => {
    if (
      !("address" in entry) ||
      !sameHex(String(entry.address), prepared.to) ||
      !("args" in entry)
    ) {
      return false;
    }
    const args = entry.args as Readonly<Record<string, unknown>>;
    const command = prepared.command;

    if (
      command.kind === "anchor-record" &&
      entry.eventName === "RecordVersionPublished"
    ) {
      return (
        sameHex(String(args.institutionId), command.institutionCommitment) &&
        sameHex(String(args.studentCommitment), command.studentCommitment) &&
        sameHex(
          String(args.versionCommitment),
          command.recordVersionCommitment,
        ) &&
        sameHex(
          String(args.previousVersionCommitment),
          prepared.previousVersionCommitment ??
            (`0x${"00".repeat(32)}` as Hex),
        )
      );
    }
    if (
      command.kind === "create-share" &&
      entry.eventName === "ShareGrantCreated"
    ) {
      return (
        sameHex(String(args.institutionId), command.institutionCommitment) &&
        sameHex(String(args.grantCommitment), command.grantCommitment) &&
        sameHex(
          String(args.recordVersionCommitment),
          command.recordVersionCommitment,
        ) &&
        args.expiresAt ===
          BigInt(Math.floor(new Date(command.expiresAt).getTime() / 1_000))
      );
    }
    if (
      command.kind === "revoke-share" &&
      entry.eventName === "ShareGrantRevoked"
    ) {
      return (
        sameHex(String(args.institutionId), command.institutionCommitment) &&
        sameHex(String(args.grantCommitment), command.grantCommitment)
      );
    }
    return false;
  });

  return matches.length === 1;
};

export class WorldChainRegistryAdapter {
  private readonly academicRecordRegistryAddress: Address;
  private readonly institutionRegistryAddress: Address;
  private readonly relayerAddress: Address;

  constructor(
    private readonly config: RegistryAdapterConfig = getRegistryAdapterConfig(),
    private readonly clients: RegistryClients = createClients(config),
  ) {
    this.academicRecordRegistryAddress = getAddress(
      config.academicRecordRegistryAddress,
    );
    this.institutionRegistryAddress = getAddress(
      config.institutionRegistryAddress,
    );
    this.relayerAddress = getAddress(config.relayerAddress);
  }

  async verifyShareGrant(
    input: z.infer<typeof registryShareVerificationInputSchema>,
  ): Promise<RegistryShareVerification> {
    const expected = registryShareVerificationInputSchema.parse(input);
    await this.validateDeployment();

    const [primaryInstitutionActive, independentInstitutionActive] =
      await Promise.all([
        readContract(
          this.clients.primary,
          this.institutionRegistryAddress,
          institutionRegistryAbi,
          "isInstitutionActive",
          [expected.institutionCommitment],
        ),
        readContract(
          this.clients.independent,
          this.institutionRegistryAddress,
          institutionRegistryAbi,
          "isInstitutionActive",
          [expected.institutionCommitment],
        ),
      ]);
    if (
      primaryInstitutionActive !== true ||
      independentInstitutionActive !== true
    ) {
      throw new PartnerIntegrationError(
        "authorization",
        "The registry institution is not independently active.",
      );
    }

    const [primaryRaw, independentRaw] = await Promise.all([
      readContract(
        this.clients.primary,
        this.academicRecordRegistryAddress,
        academicRecordRegistryAbi,
        "verifyShareGrant",
        [expected.institutionCommitment, expected.grantCommitment],
      ),
      readContract(
        this.clients.independent,
        this.academicRecordRegistryAddress,
        academicRecordRegistryAbi,
        "verifyShareGrant",
        [expected.institutionCommitment, expected.grantCommitment],
      ),
    ]);
    const primary = shareGrantReadbackSchema.parse(primaryRaw);
    const independent = shareGrantReadbackSchema.parse(independentRaw);
    const expectedExpiry = BigInt(
      Math.floor(new Date(expected.expiresAt).getTime() / 1_000),
    );
    const readbackMatches = (result: typeof primary) =>
      result[0] === true &&
      sameHex(result[1], expected.studentCommitment) &&
      sameHex(result[2], expected.recordCommitment) &&
      result[3] === expectedExpiry &&
      result[4] === false;

    if (
      !readbackMatches(primary) ||
      !readbackMatches(independent) ||
      primary.some((value, index) => value !== independent[index])
    ) {
      throw new PartnerIntegrationError(
        "integrity",
        "Primary and independent RPCs did not confirm the expected share grant.",
      );
    }

    return {
      expiresAt: expected.expiresAt,
      status: "chain-confirmed",
    };
  }

  async prepare(commandInput: RegistryCommand): Promise<PreparedRegistryTransaction> {
    const command = registryCommandSchema.parse(commandInput);
    if (this.config.mode !== "simulation-only") {
      throw new PartnerIntegrationError(
        "configuration",
        "Registry transaction preparation is disabled.",
      );
    }

    await this.validateDeployment();
    await this.validateAuthorization(command.institutionCommitment);

    let previousVersionCommitment: Hex | null = null;
    if (command.kind === "anchor-record") {
      const [primaryPrevious, independentPrevious] = await Promise.all([
        readContract(
          this.clients.primary,
          this.academicRecordRegistryAddress,
          academicRecordRegistryAbi,
          "currentRecordVersion",
          [command.institutionCommitment, command.studentCommitment],
        ),
        readContract(
          this.clients.independent,
          this.academicRecordRegistryAddress,
          academicRecordRegistryAbi,
          "currentRecordVersion",
          [command.institutionCommitment, command.studentCommitment],
        ),
      ]);
      previousVersionCommitment = asHex(
        primaryPrevious,
        "current record version",
      );
      if (
        !sameHex(
          previousVersionCommitment,
          asHex(independentPrevious, "independent current record version"),
        )
      ) {
        throw new PartnerIntegrationError(
          "integrity",
          "Registry RPCs disagree about the current record version.",
        );
      }
    }

    const call = buildCalldata(command, previousVersionCommitment);
    const decoded = decodeFunctionData({
      abi: academicRecordRegistryAbi,
      data: call.data,
    });
    if (decoded.functionName !== call.functionName) {
      throw new PartnerIntegrationError(
        "integrity",
        "Prepared registry calldata failed local verification.",
      );
    }

    const contractCall = {
      abi: academicRecordRegistryAbi,
      account: this.relayerAddress,
      address: this.academicRecordRegistryAddress,
      args: call.args,
      functionName: call.functionName,
    };
    let gas: bigint;
    let simulation: unknown;
    try {
      [gas, simulation] = await Promise.all([
        this.clients.primary.estimateContractGas(contractCall),
        this.clients.primary.simulateContract(contractCall),
      ]);
    } catch (cause) {
      throw new PartnerIntegrationError(
        "invalid-response",
        "Registry transaction simulation was rejected.",
        { cause },
      );
    }
    if (gas > this.config.maxGas) {
      throw new PartnerIntegrationError(
        "authorization",
        "Registry simulation exceeded the approved gas limit.",
      );
    }
    if (
      typeof simulation === "object" &&
      simulation !== null &&
      "request" in simulation &&
      typeof simulation.request === "object" &&
      simulation.request !== null &&
      "data" in simulation.request &&
      simulation.request.data !== undefined &&
      !sameHex(String(simulation.request.data), call.data)
    ) {
      throw new PartnerIntegrationError(
        "integrity",
        "The simulated registry calldata did not match the prepared request.",
      );
    }

    return {
      account: this.relayerAddress,
      calldataHash: keccak256(call.data),
      chainId: this.config.chainId,
      command,
      data: call.data,
      expectedEventFingerprint: expectedEventFingerprint(
        command,
        previousVersionCommitment,
      ),
      functionName: call.functionName,
      gas,
      mode: "simulation-only",
      previousVersionCommitment,
      to: this.academicRecordRegistryAddress,
      value: BigInt(0),
    };
  }

  async inspectReceipt(
    prepared: PreparedRegistryTransaction,
    transactionHash: Hash,
  ): Promise<RegistryReconciliation> {
    const command = registryCommandSchema.parse(prepared.command);
    const rebuilt = buildCalldata(
      command,
      prepared.previousVersionCommitment,
    );
    if (
      prepared.chainId !== this.config.chainId ||
      prepared.mode !== "simulation-only" ||
      prepared.value !== BigInt(0) ||
      !sameHex(prepared.account, this.relayerAddress) ||
      !sameHex(prepared.to, this.academicRecordRegistryAddress) ||
      prepared.functionName !== rebuilt.functionName ||
      !sameHex(prepared.data, rebuilt.data) ||
      !sameHex(keccak256(prepared.data), prepared.calldataHash) ||
      expectedEventFingerprint(
        command,
        prepared.previousVersionCommitment,
      ) !== prepared.expectedEventFingerprint
    ) {
      throw new PartnerIntegrationError(
        "integrity",
        "Prepared registry transaction metadata is inconsistent.",
      );
    }

    await this.validateDeployment();
    const [receipt, currentBlock] = await Promise.all([
      this.clients.primary.getTransactionReceipt({ hash: transactionHash }),
      this.clients.primary.getBlockNumber(),
    ]);
    if (
      receipt.status !== "success" ||
      receipt.transactionHash !== transactionHash ||
      !receipt.to ||
      !sameHex(receipt.to, this.academicRecordRegistryAddress) ||
      currentBlock < receipt.blockNumber ||
      !receiptEventMatches(prepared, receipt)
    ) {
      throw new PartnerIntegrationError(
        "integrity",
        "The registry receipt or emitted event did not match the prepared operation.",
      );
    }

    const confirmationCount = Number(
      currentBlock - receipt.blockNumber + BigInt(1),
    );
    if (confirmationCount < this.config.confirmations) {
      return {
        blockNumber: receipt.blockNumber,
        confirmationCount,
        expectedConfirmations: this.config.confirmations,
        status: "confirmation-pending",
        transactionHash,
      };
    }

    await this.verifyReadback(prepared);
    return {
      blockNumber: receipt.blockNumber,
      confirmationCount,
      expectedConfirmations: this.config.confirmations,
      status: "reconciled",
      transactionHash,
    };
  }

  private async validateAuthorization(institutionCommitment: Hex) {
    const [primaryActive, independentActive, primarySigner, independentSigner] =
      await Promise.all([
        readContract(
          this.clients.primary,
          this.institutionRegistryAddress,
          institutionRegistryAbi,
          "isInstitutionActive",
          [institutionCommitment],
        ),
        readContract(
          this.clients.independent,
          this.institutionRegistryAddress,
          institutionRegistryAbi,
          "isInstitutionActive",
          [institutionCommitment],
        ),
        readContract(
          this.clients.primary,
          this.institutionRegistryAddress,
          institutionRegistryAbi,
          "isAuthorizedSigner",
          [institutionCommitment, this.relayerAddress],
        ),
        readContract(
          this.clients.independent,
          this.institutionRegistryAddress,
          institutionRegistryAbi,
          "isAuthorizedSigner",
          [institutionCommitment, this.relayerAddress],
        ),
      ]);
    if (
      primaryActive !== true ||
      independentActive !== true ||
      primarySigner !== true ||
      independentSigner !== true
    ) {
      throw new PartnerIntegrationError(
        "authorization",
        "Registry institution or relayer authorization is unavailable.",
      );
    }
  }

  private async validateDeployment() {
    const [
      primaryChainId,
      independentChainId,
      primaryInstitutionCode,
      independentInstitutionCode,
      primaryRecordCode,
      independentRecordCode,
      primaryConfiguredInstitution,
      independentConfiguredInstitution,
    ] = await Promise.all([
      this.clients.primary.getChainId(),
      this.clients.independent.getChainId(),
      this.clients.primary.getCode({
        address: this.institutionRegistryAddress,
      }),
      this.clients.independent.getCode({
        address: this.institutionRegistryAddress,
      }),
      this.clients.primary.getCode({
        address: this.academicRecordRegistryAddress,
      }),
      this.clients.independent.getCode({
        address: this.academicRecordRegistryAddress,
      }),
      readContract(
        this.clients.primary,
        this.academicRecordRegistryAddress,
        academicRecordRegistryAbi,
        "institutionRegistry",
      ),
      readContract(
        this.clients.independent,
        this.academicRecordRegistryAddress,
        academicRecordRegistryAbi,
        "institutionRegistry",
      ),
    ]);

    if (
      primaryChainId !== this.config.chainId ||
      independentChainId !== this.config.chainId
    ) {
      throw new PartnerIntegrationError(
        "integrity",
        "A registry RPC returned the wrong chain ID.",
      );
    }
    requireRuntimeCode(
      primaryInstitutionCode,
      this.config.institutionRegistryCodeHash as Hex,
      "institution registry",
    );
    requireRuntimeCode(
      independentInstitutionCode,
      this.config.institutionRegistryCodeHash as Hex,
      "independent institution registry",
    );
    requireRuntimeCode(
      primaryRecordCode,
      this.config.academicRecordRegistryCodeHash as Hex,
      "academic record registry",
    );
    requireRuntimeCode(
      independentRecordCode,
      this.config.academicRecordRegistryCodeHash as Hex,
      "independent academic record registry",
    );
    if (
      asAddress(
        primaryConfiguredInstitution,
        "primary institution-registry address",
      ) !==
        this.institutionRegistryAddress ||
      asAddress(
        independentConfiguredInstitution,
        "independent institution-registry address",
      ) !==
        this.institutionRegistryAddress
    ) {
      throw new PartnerIntegrationError(
        "integrity",
        "The academic registry points to an unexpected institution registry.",
      );
    }
  }

  private async verifyReadback(prepared: PreparedRegistryTransaction) {
    const command = prepared.command;
    if (command.kind === "anchor-record") {
      const args = [
        command.institutionCommitment,
        command.recordVersionCommitment,
      ];
      const [primary, independent, primaryCurrent, independentCurrent] =
        await Promise.all([
          readContract(
            this.clients.primary,
            this.academicRecordRegistryAddress,
            academicRecordRegistryAbi,
            "getRecordVersion",
            args,
          ),
          readContract(
            this.clients.independent,
            this.academicRecordRegistryAddress,
            academicRecordRegistryAbi,
            "getRecordVersion",
            args,
          ),
          readContract(
            this.clients.primary,
            this.academicRecordRegistryAddress,
            academicRecordRegistryAbi,
            "currentRecordVersion",
            [command.institutionCommitment, command.studentCommitment],
          ),
          readContract(
            this.clients.independent,
            this.academicRecordRegistryAddress,
            academicRecordRegistryAbi,
            "currentRecordVersion",
            [command.institutionCommitment, command.studentCommitment],
          ),
        ]);
      const expectedPrevious =
        prepared.previousVersionCommitment ??
        (`0x${"00".repeat(32)}` as Hex);
      const matches = (value: unknown) =>
        Array.isArray(value) &&
        sameHex(String(value[0]), command.studentCommitment) &&
        sameHex(String(value[1]), expectedPrevious) &&
        typeof value[2] === "bigint" &&
        value[2] > BigInt(0);
      if (
        !matches(primary) ||
        !matches(independent) ||
        !sameHex(String(primaryCurrent), command.recordVersionCommitment) ||
        !sameHex(String(independentCurrent), command.recordVersionCommitment)
      ) {
        throw new PartnerIntegrationError(
          "integrity",
          "Independent registry record readback did not match the receipt.",
        );
      }
      return;
    }

    const [primary, independent] = await Promise.all([
      readContract(
        this.clients.primary,
        this.academicRecordRegistryAddress,
        academicRecordRegistryAbi,
        "verifyShareGrant",
        [command.institutionCommitment, command.grantCommitment],
      ),
      readContract(
        this.clients.independent,
        this.academicRecordRegistryAddress,
        academicRecordRegistryAbi,
        "verifyShareGrant",
        [command.institutionCommitment, command.grantCommitment],
      ),
    ]);
    const expectedExpiry =
      command.kind === "create-share"
        ? BigInt(Math.floor(new Date(command.expiresAt).getTime() / 1_000))
        : null;
    const matches = (value: unknown) => {
      if (!Array.isArray(value) || value.length !== 5) return false;
      if (command.kind === "revoke-share") {
        return value[4] === true;
      }
      return (
        sameHex(String(value[1]), command.studentCommitment) &&
        sameHex(String(value[2]), command.recordVersionCommitment) &&
        value[3] === expectedExpiry &&
        value[4] === false
      );
    };
    if (!matches(primary) || !matches(independent)) {
      throw new PartnerIntegrationError(
        "integrity",
        "Independent registry share readback did not match the receipt.",
      );
    }
  }
}

export const createWorldChainRegistryAdapter = () =>
  new WorldChainRegistryAdapter();
