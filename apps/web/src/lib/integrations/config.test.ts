import { describe, expect, it } from "vitest";

import {
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
