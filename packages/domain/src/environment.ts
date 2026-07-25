import { z } from "zod";

import {
  createCapability,
  resolveCapability,
  type CapabilityState,
} from "./capabilities";

const publicEnvironmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_WORLD_APP_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_ENS_PARENT: z.string().min(1).optional(),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().min(1).optional(),
  WORLD_CHAIN_RPC_URL: z.url().optional(),
  ZERO_G_ROUTER_URL: z.url().optional(),
});

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;

export interface EnvironmentCapabilities {
  readonly env: PublicEnvironment;
  readonly capabilities: readonly CapabilityState[];
}

const optionalState = (
  present: boolean,
  name: Parameters<typeof createCapability>[0],
  label: string,
): CapabilityState =>
  createCapability(
    name,
    present ? "available" : "not-configured",
    label,
    present ? "Configured" : "Not configured",
  );

const configured = (...values: readonly (string | undefined)[]): boolean =>
  values.every((value) => Boolean(value?.trim()));

export const parseEnvironment = (
  source: Readonly<Record<string, string | undefined>>,
): EnvironmentCapabilities => {
  const env = publicEnvironmentSchema.parse(source);
  const supabaseConfigured = Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const mockRequested = source.LOZZI_PARTNER_MOCKS === "1";
  const ensSignerConfigured =
    source.ENS_SIGNER_PROVIDER === "json-rpc"
      ? configured(source.ENS_SIGNER_ADDRESS, source.ENS_SIGNER_RPC_URL)
      : source.ENS_SIGNER_PROVIDER === "local-private-key" &&
          env.NODE_ENV !== "production"
        ? configured(source.ENS_SIGNER_PRIVATE_KEY)
        : false;

  return {
    env,
    capabilities: [
      optionalState(supabaseConfigured, "supabase", "Supabase"),
      resolveCapability({
        configured: configured(
          env.NEXT_PUBLIC_WORLD_APP_ID,
          source.WORLD_RP_ID,
          source.WORLD_RP_SIGNING_KEY,
        ),
        detailWhenAvailable: "World ID 4.x server verification is configured.",
        detailWhenMissing:
          "World app, relying-party ID, and signing key are required.",
        label: "World verification",
        mockRequested,
        name: "world",
        nodeEnvironment: env.NODE_ENV,
      }),
      resolveCapability({
        configured: configured(
          source.NEXT_PUBLIC_APP_URL,
          source.WORLD_CHAIN_MAINNET_RPC_URL,
          source.AGENTKIT_AGENT_ADDRESS,
          source.AGENTKIT_HUMAN_ID_HMAC_KEY,
          source.SUPABASE_SERVICE_ROLE_KEY,
        ),
        detailWhenAvailable:
          "AgentKit delegation, canonical AgentBook lookup, and persistent usage controls are configured.",
        detailWhenMissing:
          "App URL, World Chain mainnet RPC, agent address, HMAC key, and service database access are required.",
        label: "World AgentKit",
        name: "world-agentkit",
        nodeEnvironment: env.NODE_ENV,
      }),
      optionalState(
        Boolean(env.WORLD_CHAIN_RPC_URL),
        "world-chain",
        "World Chain Sepolia",
      ),
      resolveCapability({
        configured: configured(
          env.NEXT_PUBLIC_ENS_PARENT,
          source.ENS_PARENT_SAFE_ADDRESS,
          source.ENS_PARENT_SAFE_OWNERS,
          source.ENS_PARENT_SAFE_THRESHOLD,
          source.ENS_REGISTRAR_ADDRESS,
          source.ENS_REGISTRAR_CODE_HASH,
          source.ENS_REGISTRAR_DEPLOYMENT_BLOCK,
          source.ENS_SEPOLIA_WRITE_RPC_URL,
          source.ENS_SEPOLIA_READ_RPC_URL,
          ensSignerConfigured ? "configured" : undefined,
          source.ENS_RECONCILIATION_SECRET,
        ),
        detailWhenAvailable:
          "Durable Ethereum Sepolia ENS issuance and independent resolution are configured.",
        detailWhenMissing:
          "Sepolia Safe, verified adapter, independent RPCs, and managed signer are required.",
        label: "ENS subnames",
        mockRequested,
        name: "ens",
        nodeEnvironment: env.NODE_ENV,
      }),
      resolveCapability({
        configured: configured(
          env.ZERO_G_ROUTER_URL,
          source.ZERO_G_COMPUTE_API_KEY,
          source.ZERO_G_COMPUTE_MODEL,
          source.ZERO_G_RPC_URL,
          source.ZERO_G_INDEXER_RPC_URL,
          source.ZERO_G_STORAGE_PRIVATE_KEY,
          source.KEY_WRAPPING_MASTER_KEY,
        ),
        detailWhenAvailable:
          "Encrypted 0G Storage and server-side Compute Router are configured.",
        detailWhenMissing:
          "0G Router, storage signer, indexer, and key-wrapper credentials are required.",
        label: "0G private compute",
        mockRequested,
        name: "zero-g",
        nodeEnvironment: env.NODE_ENV,
      }),
      optionalState(
        Boolean(env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID),
        "walletconnect",
        "WalletConnect",
      ),
    ],
  };
};
