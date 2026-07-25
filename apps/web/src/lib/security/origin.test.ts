import { describe, expect, it } from "vitest";

import { isSameOrigin } from "./origin";

describe("isSameOrigin", () => {
  it("accepts the exact request host", () => {
    expect(isSameOrigin("https://lozzi.example", "lozzi.example")).toBe(true);
    expect(isSameOrigin("http://localhost:3000", "localhost:3000")).toBe(true);
  });

  it("rejects absent, malformed, or different origins", () => {
    expect(isSameOrigin(null, "lozzi.example")).toBe(false);
    expect(isSameOrigin("not a url", "lozzi.example")).toBe(false);
    expect(isSameOrigin("https://attacker.example", "lozzi.example")).toBe(false);
  });
});
