import { describe, expect, it } from "vitest";

import { resolveCapability } from "./capabilities";
import {
  createWorldSignal,
  normalizeEnsName,
  normalizeWorldNullifier,
  progressExplanationSchema,
  PROGRESS_EXPLANATION_DISCLAIMER,
  WORLD_PURPOSES,
  worldPurposeRequestSchema,
} from "./partners";

describe("partner integration domain", () => {
  it("creates a stable pseudonymous World signal", () => {
    const first = createWorldSignal("11111111-1111-4111-8111-111111111111");
    const second = createWorldSignal("11111111-1111-4111-8111-111111111111");
    const other = createWorldSignal("22222222-2222-4222-8222-222222222222");

    expect(first).toBe(second);
    expect(first).not.toBe(other);
    expect(first).toMatch(/^0x[0-9a-f]{64}$/u);
  });

  it("binds sensitive World signals to the purpose and share draft", () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    const firstDraft = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const secondDraft = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    expect(createWorldSignal(userId, "share-liveness", firstDraft)).not.toBe(
      createWorldSignal(userId, "share-liveness", secondDraft),
    );
    expect(createWorldSignal(userId, "share-liveness", firstDraft)).not.toBe(
      createWorldSignal(userId, "adult-share-consent", firstDraft),
    );
  });

  it("defines a closed least-disclosure World purpose mapping", () => {
    expect(WORLD_PURPOSES).toEqual({
      "account-humanity": expect.objectContaining({
        action: "lozzi-student-verification",
        preset: "proof-of-human",
        requireUserPresence: false,
      }),
      "share-liveness": expect.objectContaining({
        action: "lozzi-sensitive-share-selfie-check",
        preset: "selfie-check-legacy",
        requireSubject: true,
      }),
      "adult-share-consent": expect.objectContaining({
        action: "lozzi-adult-share-consent",
        allowLegacyProofs: false,
        identityAttestationRequired: true,
        preset: "identity-check",
      }),
    });
  });

  it("requires share purposes to identify a share draft", () => {
    expect(
      worldPurposeRequestSchema.safeParse({ purpose: "share-liveness" })
        .success,
    ).toBe(false);
    expect(
      worldPurposeRequestSchema.safeParse({
        purpose: "account-humanity",
        subjectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }).success,
    ).toBe(false);
  });

  it("normalizes a World nullifier as a decimal integer", () => {
    expect(normalizeWorldNullifier("0x0a")).toBe("10");
    expect(() => normalizeWorldNullifier("ten")).toThrow(/256-bit/u);
  });

  it("uses ENSIP-15 normalization", () => {
    expect(normalizeEnsName(" Alice.ETH ")).toBe("alice.eth");
    expect(() => normalizeEnsName("")).toThrow(/required/u);
  });

  it("rejects incomplete AI explanations", () => {
    const result = progressExplanationSchema.safeParse({
      summary: "You have started the programme.",
      progressHighlights: [],
      possibleNextCourses: [],
      risks: [],
      disclaimer: "AI output",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a bounded advisory explanation", () => {
    const result = progressExplanationSchema.parse({
      summary: "Your published programming course counts toward the programme.",
      progressHighlights: ["Three credits are complete."],
      possibleNextCourses: [
        {
          courseCode: "CS 2305",
          reason: "It follows the completed introductory course.",
          requiresAdvisorReview: true,
        },
      ],
      risks: ["Confirm the next-term plan with an advisor."],
      disclaimer: PROGRESS_EXPLANATION_DISCLAIMER,
    });
    expect(result.possibleNextCourses).toHaveLength(1);
  });

  it("allows mocks only in development", () => {
    const development = resolveCapability({
      configured: false,
      detailWhenAvailable: "Configured",
      detailWhenMissing: "Not configured",
      label: "World verification",
      mockRequested: true,
      name: "world",
      nodeEnvironment: "development",
    });
    const production = resolveCapability({
      configured: false,
      detailWhenAvailable: "Configured",
      detailWhenMissing: "Not configured",
      label: "World verification",
      mockRequested: true,
      name: "world",
      nodeEnvironment: "production",
    });

    expect(development.status).toBe("mock-development");
    expect(production.status).toBe("not-configured");
  });
});
