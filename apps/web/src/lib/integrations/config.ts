import "server-only";

import { Buffer } from "node:buffer";

import { z } from "zod";

const privateKeySchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/u, "Expected a 32-byte private key");
const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/u, "Expected an Ethereum address");

const worldConfigSchema = z
  .object({
    appId: z.string().regex(/^app_[A-Za-z0-9_]+$/u),
    environment: z.enum(["production", "sandbox", "staging"]),
    rpId: z.string().regex(/^rp_[A-Za-z0-9_]+$/u),
    signingKey: privateKeySchema,
  })
  .strict();

const ensConfigSchema = z
  .object({
    parentName: z.string().min(1).max(255),
    registrarAddress: addressSchema,
    rpcUrl: z.url(),
    signerPrivateKey: privateKeySchema,
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
export type EnsConfig = z.infer<typeof ensConfigSchema>;
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
  parseRequired("ENS", ensConfigSchema, {
    parentName: source.NEXT_PUBLIC_ENS_PARENT,
    registrarAddress: source.ENS_REGISTRAR_ADDRESS,
    rpcUrl: source.ENS_SEPOLIA_RPC_URL,
    signerPrivateKey: source.ENS_SIGNER_PRIVATE_KEY,
  });

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
