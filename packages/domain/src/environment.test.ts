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
});
