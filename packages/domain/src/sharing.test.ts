import { describe, expect, it } from "vitest";

import { sensitiveShareDraftInputSchema } from "./sharing";

const validInput = {
  expiryMinutes: 15,
  recipientLabel: "Graduate admissions office",
  scopes: ["record-summary"],
} as const;

describe("sensitiveShareDraftInputSchema", () => {
  it("preserves only the explicitly selected disclosure scopes", () => {
    expect(sensitiveShareDraftInputSchema.parse(validInput)).toEqual(
      validInput,
    );
  });

  it.each([
    { ...validInput, scopes: [] },
    { ...validInput, scopes: ["program", "program"] },
    { ...validInput, scopes: ["private-transcript"] },
    { ...validInput, expiryMinutes: 31 },
  ])("rejects an unsafe disclosure request", (input) => {
    expect(() => sensitiveShareDraftInputSchema.parse(input)).toThrow();
  });

  it("rejects silently added fields", () => {
    expect(() =>
      sensitiveShareDraftInputSchema.parse({
        ...validInput,
        includeAllRecords: true,
      }),
    ).toThrow();
  });
});
