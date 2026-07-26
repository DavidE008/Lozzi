import "server-only";

import { Buffer } from "node:buffer";

import { z } from "zod";

const privateKeySchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/u, "Expected a 32-byte private key");
const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/u, "Expected an Ethereum address");
const bytes32Schema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/u, "Expected a 32-byte hexadecimal value");

const worldConfigSchema = z
  .object({
    appId: z.string().regex(/^app_[A-Za-z0-9_]+$/u),
    environment: z.enum(["production", "sandbox", "staging"]),
    rpId: z.string().regex(/^rp_[A-Za-z0-9_]+$/u),
    signingKey: privateKeySchema,
  })
  .strict();

const appUrlSchema = z
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.username === "" &&
      url.password === "" &&
      url.hash === "" &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" &&
          (url.hostname === "localhost" || url.hostname === "127.0.0.1")))
    );
  }, "Expected HTTPS, or HTTP only for local development");

const ensConfigInputSchema = z
  .object({
    confirmations: z.coerce.number().int().min(1).max(64).default(3),
    deploymentBlock: z.coerce.bigint().min(BigInt(0)),
    maxFeeWei: z.coerce.bigint().positive().max(BigInt("100000000000000000")),
    maxGas: z.coerce.bigint().positive().max(BigInt(3_000_000)),
    nodeEnvironment: z
      .enum(["development", "test", "production"])
      .default("development"),
    parentName: z.string().min(1).max(255),
    registrarAddress: addressSchema,
    registrarCodeHash: bytes32Schema,
    readRpcUrl: z.url(),
    safeAddress: addressSchema,
    safeOwners: z.array(addressSchema).min(1).max(10),
    safeThreshold: z.coerce.number().int().min(1).max(10),
    signerAddress: addressSchema.optional(),
    signerPrivateKey: privateKeySchema.optional(),
    signerProvider: z.enum(["json-rpc", "local-private-key"]),
    signerRpcUrl: z.url().optional(),
    writeRpcUrl: z.url(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.nodeEnvironment === "production" &&
      value.signerProvider === "local-private-key"
    ) {
      context.addIssue({
        code: "custom",
        message: "Raw ENS private keys are forbidden in production",
        path: ["signerProvider"],
      });
    }
    if (
      value.signerProvider === "local-private-key" &&
      !value.signerPrivateKey
    ) {
      context.addIssue({
        code: "custom",
        message: "The local ENS signer requires a private key",
        path: ["signerPrivateKey"],
      });
    }
    if (
      value.signerProvider === "json-rpc" &&
      (!value.signerAddress || !value.signerRpcUrl)
    ) {
      context.addIssue({
        code: "custom",
        message: "The managed JSON-RPC signer requires an address and RPC URL",
        path: ["signerProvider"],
      });
    }
    if (
      value.nodeEnvironment === "production" &&
      value.readRpcUrl === value.writeRpcUrl
    ) {
      context.addIssue({
        code: "custom",
        message: "Production ENS confirmation requires an independent read RPC",
        path: ["readRpcUrl"],
      });
    }
    const uniqueSafeOwners = new Set(
      value.safeOwners.map((address) => address.toLowerCase()),
    );
    if (
      uniqueSafeOwners.size !== value.safeOwners.length ||
      value.safeThreshold > value.safeOwners.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Safe owners must be unique and satisfy the threshold",
        path: ["safeOwners"],
      });
    }
  })
  .transform((value) => ({
    confirmations: value.confirmations,
    deploymentBlock: value.deploymentBlock,
    maxFeeWei: value.maxFeeWei,
    maxGas: value.maxGas,
    parentName: value.parentName,
    readRpcUrl: value.readRpcUrl,
    registrarAddress: value.registrarAddress,
    registrarCodeHash: value.registrarCodeHash,
    safeAddress: value.safeAddress,
    safeOwners: value.safeOwners,
    safeThreshold: value.safeThreshold,
    signer:
      value.signerProvider === "local-private-key"
        ? ({
            privateKey: value.signerPrivateKey!,
            type: "local-private-key",
          } as const)
        : ({
            address: value.signerAddress!,
            rpcUrl: value.signerRpcUrl!,
            type: "json-rpc",
          } as const),
    writeRpcUrl: value.writeRpcUrl,
  }));

const ensWalletLinkConfigSchema = z
  .object({
    appUrl: appUrlSchema,
    readRpcUrl: z.url(),
  })
  .strict();

const zeroGStorageConfigSchema = z
  .object({
    indexerRpcUrl: z.url(),
    keyWrappingMasterKey: z.string().refine(
      (value) => {
        try {
          return Buffer.from(value, "base64").length === 32;
        } catch {
          return false;
        }
      },
      { message: "Expected a base64-encoded 32-byte key" },
    ),
    rpcUrl: z.url(),
    signerPrivateKey: privateKeySchema,
  })
  .strict();

const zeroGComputeConfigSchema = z
  .object({
    apiKey: z.string().min(1),
    model: z.string().min(1).max(160),
    routerUrl: z.url(),
  })
  .strict();

const serviceDatabaseConfigSchema = z
  .object({
    secretKey: z.string().min(20),
    url: z.url(),
  })
  .strict();

const ensReconciliationConfigSchema = z
  .object({
    secret: z.string().min(32),
  })
  .strict();

const agentKitConfigSchema = z
  .object({
    agentAddress: addressSchema,
    appUrl: z.url(),
    facilitatorUrl: z.url(),
    humanIdHmacKey: z.string().refine(
      (value) => {
        try {
          return Buffer.from(value, "base64").length === 32;
        } catch {
          return false;
        }
      },
      { message: "Expected a base64-encoded 32-byte HMAC key" },
    ),
    worldChainRpcUrl: z.url(),
  })
  .strict();

export type WorldConfig = z.infer<typeof worldConfigSchema>;
export type EnsConfig = z.infer<typeof ensConfigInputSchema>;
export type EnsWalletLinkConfig = z.infer<typeof ensWalletLinkConfigSchema>;
export type EnsReconciliationConfig = z.infer<
  typeof ensReconciliationConfigSchema
>;
export type ZeroGStorageConfig = z.infer<typeof zeroGStorageConfigSchema>;
export type ZeroGComputeConfig = z.infer<typeof zeroGComputeConfigSchema>;
export type ServiceDatabaseConfig = z.infer<typeof serviceDatabaseConfigSchema>;
export type AgentKitConfig = z.infer<typeof agentKitConfigSchema>;

export class IntegrationConfigurationError extends Error {
  readonly category = "configuration";

  constructor(readonly integration: string) {
    super(`${integration} is not configured.`);
    this.name = "IntegrationConfigurationError";
  }
}

const parseRequired = <Output>(
  integration: string,
  schema: z.ZodType<Output>,
  input: unknown,
): Output => {
  const result = schema.safeParse(input);
  if (!result.success) throw new IntegrationConfigurationError(integration);
  return result.data;
};

export const getWorldConfig = (
  source: Readonly<Record<string, string | undefined>> = process.env,
): WorldConfig =>
  parseRequired("World ID", worldConfigSchema, {
    appId: source.NEXT_PUBLIC_WORLD_APP_ID,
    environment: source.WORLD_ID_ENVIRONMENT ?? "production",
    rpId: source.WORLD_RP_ID,
    signingKey: source.WORLD_RP_SIGNING_KEY,
  });

export const getEnsConfig = (
  source: Readonly<Record<string, string | undefined>> = process.env,
): EnsConfig =>
  parseRequired("ENS", ensConfigInputSchema, {
    confirmations: source.ENS_CONFIRMATIONS ?? "3",
    deploymentBlock: source.ENS_REGISTRAR_DEPLOYMENT_BLOCK,
    maxFeeWei: source.ENS_MAX_FEE_WEI ?? "10000000000000000",
    maxGas: source.ENS_MAX_GAS ?? "800000",
    nodeEnvironment: source.NODE_ENV ?? "development",
    parentName: source.NEXT_PUBLIC_ENS_PARENT,
    registrarAddress: source.ENS_REGISTRAR_ADDRESS,
    registrarCodeHash: source.ENS_REGISTRAR_CODE_HASH,
    readRpcUrl: source.ENS_SEPOLIA_READ_RPC_URL,
    safeAddress: source.ENS_PARENT_SAFE_ADDRESS,
    safeOwners:
      source.ENS_PARENT_SAFE_OWNERS?.split(",")
        .map((address) => address.trim())
        .filter(Boolean) ?? [],
    safeThreshold: source.ENS_PARENT_SAFE_THRESHOLD ?? "2",
    signerAddress: source.ENS_SIGNER_ADDRESS,
    signerPrivateKey: source.ENS_SIGNER_PRIVATE_KEY,
    signerProvider: source.ENS_SIGNER_PROVIDER,
    signerRpcUrl: source.ENS_SIGNER_RPC_URL,
    writeRpcUrl: source.ENS_SEPOLIA_WRITE_RPC_URL,
  });

export const getEnsWalletLinkConfig = (
  source: Readonly<Record<string, string | undefined>> = process.env,
): EnsWalletLinkConfig =>
  parseRequired("ENS wallet linking", ensWalletLinkConfigSchema, {
    appUrl: source.NEXT_PUBLIC_APP_URL,
    readRpcUrl: source.ENS_SEPOLIA_READ_RPC_URL,
  });

export const isEnsWalletLinkConfigured = (
  source: Readonly<Record<string, string | undefined>> = process.env,
): boolean =>
  ensWalletLinkConfigSchema.safeParse({
    appUrl: source.NEXT_PUBLIC_APP_URL,
    readRpcUrl: source.ENS_SEPOLIA_READ_RPC_URL,
  }).success;

export const getZeroGStorageConfig = (
  source: Readonly<Record<string, string | undefined>> = process.env,
): ZeroGStorageConfig =>
  parseRequired("0G Storage", zeroGStorageConfigSchema, {
    indexerRpcUrl: source.ZERO_G_INDEXER_RPC_URL,
    keyWrappingMasterKey: source.KEY_WRAPPING_MASTER_KEY,
    rpcUrl: source.ZERO_G_RPC_URL,
    signerPrivateKey: source.ZERO_G_STORAGE_PRIVATE_KEY,
  });

export const getZeroGComputeConfig = (
  source: Readonly<Record<string, string | undefined>> = process.env,
): ZeroGComputeConfig =>
  parseRequired("0G Compute", zeroGComputeConfigSchema, {
    apiKey: source.ZERO_G_COMPUTE_API_KEY,
    model: source.ZERO_G_COMPUTE_MODEL,
    routerUrl: source.ZERO_G_ROUTER_URL,
  });

export const getServiceDatabaseConfig = (
  source: Readonly<Record<string, string | undefined>> = process.env,
): ServiceDatabaseConfig =>
  parseRequired("Supabase server writes", serviceDatabaseConfigSchema, {
    secretKey: source.SUPABASE_SERVICE_ROLE_KEY,
    url: source.NEXT_PUBLIC_SUPABASE_URL,
  });

export const getEnsReconciliationConfig = (
  source: Readonly<Record<string, string | undefined>> = process.env,
): EnsReconciliationConfig =>
  parseRequired("ENS reconciliation", ensReconciliationConfigSchema, {
    secret: source.ENS_RECONCILIATION_SECRET,
  });

export const getAgentKitConfig = (
  source: Readonly<Record<string, string | undefined>> = process.env,
): AgentKitConfig =>
  parseRequired("World AgentKit", agentKitConfigSchema, {
    agentAddress: source.AGENTKIT_AGENT_ADDRESS,
    appUrl: source.NEXT_PUBLIC_APP_URL,
    facilitatorUrl:
      source.AGENTKIT_FACILITATOR_URL ??
      "https://x402-worldchain.vercel.app/facilitator",
    humanIdHmacKey: source.AGENTKIT_HUMAN_ID_HMAC_KEY,
    worldChainRpcUrl: source.WORLD_CHAIN_MAINNET_RPC_URL,
  });
