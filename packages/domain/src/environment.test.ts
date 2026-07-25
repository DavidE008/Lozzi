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
