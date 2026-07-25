import { describe, expect, it } from "vitest";

import {
  buildContentSecurityPolicy,
  hasConfiguredWorldBrowserFlow,
} from "./content-security-policy";

describe("content security policy", () => {
  it("allows only same-origin connections when integrations are absent", () => {
    const policy = buildContentSecurityPolicy({
      isDevelopment: false,
      nonce: "nonce-value",
      worldFlowConfigured: false,
    });

    expect(policy).toContain("connect-src 'self'");
    expect(policy).not.toContain("bridge.worldcoin.org");
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it("allows the configured database and official World bridge", () => {
    const policy = buildContentSecurityPolicy({
      isDevelopment: true,
      nonce: "nonce-value",
      supabaseUrl: "https://project.supabase.co/path",
      worldFlowConfigured: true,
    });

    expect(policy).toContain(
      "connect-src 'self' https://project.supabase.co https://bridge.worldcoin.org",
    );
    expect(policy).toContain("'unsafe-eval'");
    expect(policy).not.toContain("world-id-assets.com");
  });

  it("requires the complete server-side World credential set", () => {
    expect(
      hasConfiguredWorldBrowserFlow({
        WORLD_APP_ID: "app_example",
        WORLD_RP_ID: "rp_example",
      }),
    ).toBe(false);
    expect(
      hasConfiguredWorldBrowserFlow({
        WORLD_APP_ID: "app_example",
        WORLD_RP_ID: "rp_example",
        WORLD_RP_SIGNING_KEY: "secret",
      }),
    ).toBe(true);
  });
});

