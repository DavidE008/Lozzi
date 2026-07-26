import { describe, expect, it } from "vitest";

import {
  publicVerifierRequestSchema,
  publicVerifierResultSchema,
} from "./public-verifier";

describe("public verifier schemas", () => {
  it("accepts a bounded bearer token only in the request body", () => {
    expect(
      publicVerifierRequestSchema.parse({
        token: "synthetic_private_token_123456",
      }),
    ).toEqual({ token: "synthetic_private_token_123456" });
    expect(() =>
      publicVerifierRequestSchema.parse({
        token: "synthetic_private_token_123456",
        tokenQuery: "not-allowed",
      }),
    ).toThrow();
  });

  it("rejects disclosure fields outside the authorized scopes", () => {
    expect(() =>
      publicVerifierResultSchema.parse({
        disclosure: {
          program: {
            credentialType: "BSc",
            name: "Computer Science",
          },
        },
        expiresAt: "2026-07-26T12:30:00.000Z",
        issuer: { name: "Synthetic University" },
        record: {
          anchorStatus: "not_configured",
          commitment: `0x${"ab".repeat(32)}`,
          publishedAt: "2026-07-26T12:00:00.000Z",
          versionNumber: 2,
        },
        scopes: ["record-summary"],
        status: "locally_verified",
      }),
    ).toThrow();
  });

  it("accepts explicit local, pending, confirmed, and unavailable states", () => {
    for (const status of [
      "locally_verified",
      "pending_anchor",
      "chain_confirmed",
      "configuration_unavailable",
    ] as const) {
      expect(
        publicVerifierResultSchema.parse({
          disclosure: {
            "record-summary": {
              courseCount: 2,
              creditsEarned: 6,
              latestPublishedAt: "2026-07-26T12:00:00.000Z",
            },
          },
          expiresAt: "2026-07-26T12:30:00.000Z",
          issuer: { name: "Synthetic University" },
          record: {
            anchorStatus: "not_configured",
            commitment: `0x${"ab".repeat(32)}`,
            publishedAt: "2026-07-26T12:00:00.000Z",
            versionNumber: 2,
          },
          scopes: ["record-summary"],
          status,
        }),
      ).toMatchObject({ status });
    }
  });

  it("accepts PostgreSQL timestamp offsets at the service boundary", () => {
    expect(
      publicVerifierResultSchema.parse({
        disclosure: {
          program: {
            credentialType: "bachelors",
            name: "Computer Science",
          },
        },
        expiresAt: "2027-01-15T12:00:00+00:00",
        issuer: { name: "Synthetic University" },
        record: {
          anchorStatus: "not_configured",
          commitment: `0x${"ab".repeat(32)}`,
          publishedAt: "2026-05-21T11:05:00+00:00",
          versionNumber: 1,
        },
        scopes: ["program"],
        status: "locally_verified",
      }),
    ).toMatchObject({ status: "locally_verified" });
  });
});
