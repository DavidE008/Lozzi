import { describe, expect, it } from "vitest";

import { getVerifierRequestFingerprint } from "./request-security";

describe("public verifier request fingerprint", () => {
  it("creates a stable opaque fingerprint without retaining the address", () => {
    const request = new Request("https://lozzi.test/api/verify", {
      headers: {
        "user-agent": "synthetic-browser",
        "x-forwarded-for": "203.0.113.10, 198.51.100.2",
      },
    });
    const environment: NodeJS.ProcessEnv = {
      LOZZI_VERIFIER_FINGERPRINT_SECRET:
        "synthetic-fingerprint-secret-at-least-32-characters",
      NODE_ENV: "production",
    };

    const fingerprint = getVerifierRequestFingerprint(request, environment);
    expect(fingerprint).toMatch(/^0x[0-9a-f]{64}$/u);
    expect(fingerprint).not.toContain("203.0.113.10");
    expect(getVerifierRequestFingerprint(request, environment)).toBe(
      fingerprint,
    );
  });

  it("fails closed in production when the fingerprint secret is absent", () => {
    expect(() =>
      getVerifierRequestFingerprint(
        new Request("https://lozzi.test/api/verify"),
        { NODE_ENV: "production" },
      ),
    ).toThrow("fingerprinting is not configured");
  });
});
