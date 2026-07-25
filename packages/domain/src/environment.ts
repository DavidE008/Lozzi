import { z } from "zod";

import { createCapability, type CapabilityState } from "./capabilities";

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

export const parseEnvironment = (
  source: Readonly<Record<string, string | undefined>>,
): EnvironmentCapabilities => {
  const env = publicEnvironmentSchema.parse(source);
  const supabaseConfigured = Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  return {
    env,
    capabilities: [
      optionalState(supabaseConfigured, "supabase", "Supabase"),
      optionalState(
        Boolean(env.NEXT_PUBLIC_WORLD_APP_ID),
        "world",
        "World verification",
      ),
      optionalState(
        Boolean(env.WORLD_CHAIN_RPC_URL),
        "world-chain",
        "World Chain Sepolia",
      ),
      optionalState(Boolean(env.NEXT_PUBLIC_ENS_PARENT), "ens", "ENS subnames"),
      optionalState(
        Boolean(env.ZERO_G_ROUTER_URL),
        "zero-g",
        "0G Compute Router",
      ),
      optionalState(
        Boolean(env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID),
        "walletconnect",
        "WalletConnect",
      ),
    ],
  };
};
