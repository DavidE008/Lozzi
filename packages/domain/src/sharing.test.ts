import { describe, expect, it } from "vitest";

import {
  sensitiveShareDraftInputSchema,
  sensitiveShareRevocationResultSchema,
} from "./sharing";

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

describe("sensitiveShareRevocationResultSchema", () => {
  it("distinguishes immediate revocation from derived expiration", () => {
    expect(
      sensitiveShareRevocationResultSchema.parse({
        chainStatus: "revocation_pending",
        idempotentReplay: false,
        reconciliationQueued: true,
        revokedAt: "2026-07-26T04:00:00+00:00",
        shareGrantId: "10000000-0000-4000-8000-000000000201",
        status: "revoked",
      }),
    ).toMatchObject({ status: "revoked" });
    expect(
      sensitiveShareRevocationResultSchema.parse({
        chainStatus: "local_private",
        expiresAt: "2026-07-26T04:00:00+00:00",
        idempotentReplay: true,
        reconciliationQueued: false,
        status: "expired",
      }),
    ).toMatchObject({ status: "expired" });
  });

  it("rejects a revocation result that omits its reconciliation state", () => {
    expect(() =>
      sensitiveShareRevocationResultSchema.parse({
        idempotentReplay: false,
        revokedAt: "2026-07-26T04:00:00+00:00",
        shareGrantId: "10000000-0000-4000-8000-000000000201",
        status: "revoked",
      }),
    ).toThrow();
  });
});
