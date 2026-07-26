import { describe, expect, it } from "vitest";

import {
  getAgentKitConfig,
  getEnsConfig,
  getWorldConfig,
  getZeroGStorageConfig,
  isEnsWalletLinkConfigured,
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

  it("accepts only the complete managed ENS signer and approved Safe", () => {
    const config = getEnsConfig({
      ENS_PARENT_SAFE_ADDRESS: `0x${"11".repeat(20)}`,
      ENS_PARENT_SAFE_OWNERS: [
        `0x${"12".repeat(20)}`,
        `0x${"13".repeat(20)}`,
        `0x${"14".repeat(20)}`,
      ].join(","),
      ENS_PARENT_SAFE_THRESHOLD: "2",
      ENS_REGISTRAR_ADDRESS: `0x${"15".repeat(20)}`,
      ENS_REGISTRAR_CODE_HASH: `0x${"16".repeat(32)}`,
      ENS_REGISTRAR_DEPLOYMENT_BLOCK: "100",
      ENS_SEPOLIA_READ_RPC_URL: "https://read.example",
      ENS_SEPOLIA_WRITE_RPC_URL: "https://write.example",
      ENS_SIGNER_ADDRESS: `0x${"17".repeat(20)}`,
      ENS_SIGNER_PROVIDER: "json-rpc",
      ENS_SIGNER_RPC_URL: "https://signer.example",
      NEXT_PUBLIC_ENS_PARENT: "lozzi-sepolia.eth",
      NODE_ENV: "production",
    });

    expect(config).toMatchObject({
      parentName: "lozzi-sepolia.eth",
      safeThreshold: 2,
      signer: {
        address: `0x${"17".repeat(20)}`,
        type: "json-rpc",
      },
    });
    expect(config.safeOwners).toHaveLength(3);
  });

  it("detects wallet verification independently from ENS issuance", () => {
    expect(
      isEnsWalletLinkConfigured({
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        ENS_SEPOLIA_READ_RPC_URL: "https://read.example",
      }),
    ).toBe(true);
    expect(
      isEnsWalletLinkConfigured({
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }),
    ).toBe(false);
    expect(
      isEnsWalletLinkConfigured({
        NEXT_PUBLIC_APP_URL: "http://remote.example",
        ENS_SEPOLIA_READ_RPC_URL: "https://read.example",
      }),
    ).toBe(false);
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
