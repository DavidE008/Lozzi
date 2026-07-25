import { describe, expect, it } from "vitest";

import { createGeneratedEnsAlias, isGeneratedEnsAlias } from "./ens-aliases";

describe("generated ENS aliases", () => {
  it("creates a bounded privacy-safe alias from entropy", () => {
    const alias = createGeneratedEnsAlias(1, 2, 7);

    expect(alias).toBe("calm-harbor-07");
    expect(isGeneratedEnsAlias(alias)).toBe(true);
    expect(alias.length).toBeLessThanOrEqual(32);
  });

  it("rejects labels outside the controlled vocabulary", () => {
    expect(isGeneratedEnsAlias("student-1234")).toBe(false);
    expect(isGeneratedEnsAlias("Calm-harbor-07")).toBe(false);
    expect(isGeneratedEnsAlias("calm--harbor-07")).toBe(false);
  });
});
