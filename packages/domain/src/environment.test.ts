import { describe, expect, it } from "vitest";

import { parseEnvironment } from "./environment";

describe("environment capability detection", () => {
  it("reports optional partners honestly", () => {
    const result = parseEnvironment({ NODE_ENV: "test" });
    expect(
      result.capabilities.every(({ status }) => status === "not-configured"),
    ).toBe(true);
  });

  it("requires both public Supabase values", () => {
    const result = parseEnvironment({
      NODE_ENV: "test",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    });
    expect(result.capabilities[0]?.status).toBe("not-configured");
  });

  it("does not claim World availability from a public app ID alone", () => {
    const result = parseEnvironment({
      NODE_ENV: "production",
      NEXT_PUBLIC_WORLD_APP_ID: "app_example",
    });
    expect(
      result.capabilities.find(({ name }) => name === "world")?.status,
    ).toBe("not-configured");
  });

  it("requires every server boundary before enabling AgentKit", () => {
    const incomplete = parseEnvironment({
      AGENTKIT_AGENT_ADDRESS: `0x${"11".repeat(20)}`,
      AGENTKIT_HUMAN_ID_HMAC_KEY: "local-hmac-key",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NODE_ENV: "production",
      WORLD_CHAIN_MAINNET_RPC_URL: "https://worldchain.example",
    });
    expect(
      incomplete.capabilities.find(({ name }) => name === "world-agentkit")
        ?.status,
    ).toBe("not-configured");

    const complete = parseEnvironment({
      AGENTKIT_AGENT_ADDRESS: `0x${"11".repeat(20)}`,
      AGENTKIT_HUMAN_ID_HMAC_KEY: "local-hmac-key",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NODE_ENV: "production",
      SUPABASE_SERVICE_ROLE_KEY: "server-secret",
      WORLD_CHAIN_MAINNET_RPC_URL: "https://worldchain.example",
    });
    expect(
      complete.capabilities.find(({ name }) => name === "world-agentkit")
        ?.status,
    ).toBe("available");
  });

  it("requires the complete encrypted 0G path", () => {
    const result = parseEnvironment({
      NODE_ENV: "production",
      ZERO_G_ROUTER_URL: "https://router.example",
      ZERO_G_COMPUTE_API_KEY: "secret",
      ZERO_G_COMPUTE_MODEL: "model",
      ZERO_G_RPC_URL: "https://rpc.example",
      ZERO_G_INDEXER_RPC_URL: "https://indexer.example",
      ZERO_G_STORAGE_PRIVATE_KEY: "0x01",
      KEY_WRAPPING_MASTER_KEY: "base64-key",
    });
    expect(
      result.capabilities.find(({ name }) => name === "zero-g")?.status,
    ).toBe("available");
  });

  it("never reports a raw ENS private key as production-ready", () => {
    const result = parseEnvironment({
      ENS_CONFIRMATIONS: "3",
      ENS_MAX_FEE_WEI: "10000000000000000",
      ENS_MAX_GAS: "800000",
      ENS_PARENT_SAFE_ADDRESS: `0x${"11".repeat(20)}`,
      ENS_PARENT_SAFE_OWNERS: [
        `0x${"12".repeat(20)}`,
        `0x${"13".repeat(20)}`,
        `0x${"14".repeat(20)}`,
      ].join(","),
      ENS_PARENT_SAFE_THRESHOLD: "2",
      ENS_RECONCILIATION_SECRET: "r".repeat(32),
      ENS_REGISTRAR_ADDRESS: `0x${"15".repeat(20)}`,
      ENS_REGISTRAR_CODE_HASH: `0x${"16".repeat(32)}`,
      ENS_REGISTRAR_DEPLOYMENT_BLOCK: "1",
      ENS_SEPOLIA_READ_RPC_URL: "https://read.example",
      ENS_SEPOLIA_WRITE_RPC_URL: "https://write.example",
      ENS_SIGNER_PRIVATE_KEY: `0x${"17".repeat(32)}`,
      ENS_SIGNER_PROVIDER: "local-private-key",
      NEXT_PUBLIC_ENS_PARENT: "lozzi-sepolia.eth",
      NODE_ENV: "production",
    });

    expect(result.capabilities.find(({ name }) => name === "ens")?.status).toBe(
      "not-configured",
    );
  });

  it("labels development mocks but never enables them in production", () => {
    const development = parseEnvironment({
      NODE_ENV: "development",
      LOZZI_PARTNER_MOCKS: "1",
    });
    const production = parseEnvironment({
      NODE_ENV: "production",
      LOZZI_PARTNER_MOCKS: "1",
    });

    expect(
      development.capabilities.find(({ name }) => name === "world")?.status,
    ).toBe("mock-development");
    expect(
      production.capabilities.find(({ name }) => name === "world")?.status,
    ).toBe("not-configured");
  });
});
