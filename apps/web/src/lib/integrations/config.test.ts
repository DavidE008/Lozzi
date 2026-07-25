import { describe, expect, it } from "vitest";

import {
  getAgentKitConfig,
  getEnsConfig,
  getWorldConfig,
  getZeroGStorageConfig,
  IntegrationConfigurationError,
} from "./config";

describe("partner server configuration", () => {
  it("requires a complete World relying-party configuration", () => {
    expect(() =>
      getWorldConfig({ NEXT_PUBLIC_WORLD_APP_ID: "app_example" }),
    ).toThrow(IntegrationConfigurationError);
  });

  it("parses World secrets without returning unrelated environment values", () => {
    const config = getWorldConfig({
      NEXT_PUBLIC_WORLD_APP_ID: "app_example",
      WORLD_ID_ENVIRONMENT: "staging",
      WORLD_RP_ID: "rp_example",
      WORLD_RP_SIGNING_KEY: `0x${"11".repeat(32)}`,
      UNRELATED_SECRET: "do-not-copy",
    });

    expect(config).toEqual({
      appId: "app_example",
      environment: "staging",
      rpId: "rp_example",
      signingKey: `0x${"11".repeat(32)}`,
    });
  });

  it("accepts the isolated Selfie Sandbox environment", () => {
    const config = getWorldConfig({
      NEXT_PUBLIC_WORLD_APP_ID: "app_example",
      WORLD_ID_ENVIRONMENT: "sandbox",
      WORLD_RP_ID: "rp_example",
      WORLD_RP_SIGNING_KEY: `0x${"22".repeat(32)}`,
    });

    expect(config.environment).toBe("sandbox");
  });

  it("requires isolated AgentKit RPC and HMAC configuration", () => {
    expect(() =>
      getAgentKitConfig({
        AGENTKIT_AGENT_ADDRESS: `0x${"11".repeat(20)}`,
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }),
    ).toThrow(/World AgentKit is not configured/u);

    expect(
      getAgentKitConfig({
        AGENTKIT_AGENT_ADDRESS: `0x${"11".repeat(20)}`,
        AGENTKIT_HUMAN_ID_HMAC_KEY: Buffer.alloc(32, 7).toString("base64"),
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        WORLD_CHAIN_MAINNET_RPC_URL: "https://worldchain.example",
      }),
    ).toEqual({
      agentAddress: `0x${"11".repeat(20)}`,
      appUrl: "http://localhost:3000",
      facilitatorUrl: "https://x402-worldchain.vercel.app/facilitator",
      humanIdHmacKey: Buffer.alloc(32, 7).toString("base64"),
      worldChainRpcUrl: "https://worldchain.example",
    });
  });

  it("requires a checksummed-length ENS registrar and signer", () => {
    expect(() =>
      getEnsConfig({
        NEXT_PUBLIC_ENS_PARENT: "lozzi-sepolia.eth",
        ENS_SEPOLIA_RPC_URL: "https://rpc.example",
      }),
    ).toThrow(/ENS is not configured/u);
  });

  it("requires an exact 32-byte key-wrapping key", () => {
    expect(() =>
      getZeroGStorageConfig({
        ZERO_G_INDEXER_RPC_URL: "https://indexer.example",
        ZERO_G_RPC_URL: "https://rpc.example",
        ZERO_G_STORAGE_PRIVATE_KEY: `0x${"22".repeat(32)}`,
        KEY_WRAPPING_MASTER_KEY: Buffer.from("short").toString("base64"),
      }),
    ).toThrow(/0G Storage is not configured/u);
  });
});
