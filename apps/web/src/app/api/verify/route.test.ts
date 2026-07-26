import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fingerprint: vi.fn(() => `0x${"ab".repeat(32)}` as const),
  logEvent: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("@/lib/logging", () => ({ logEvent: mocks.logEvent }));
vi.mock("@/lib/public-verifier/request-security", () => ({
  getVerifierRequestFingerprint: mocks.fingerprint,
}));
vi.mock("@/lib/public-verifier/service", () => ({
  verifyPublicShare: mocks.verify,
}));

import { POST } from "./route";

const request = (body: unknown, url = "https://lozzi.test/api/verify") =>
  new Request(url, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "user-agent": "synthetic-test",
      "x-forwarded-for": "203.0.113.10",
    },
    method: "POST",
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/verify", () => {
  it("passes the token and opaque request fingerprint through the service boundary", async () => {
    mocks.verify.mockResolvedValue({ status: "invalid" });
    const response = await POST(
      request({ token: "synthetic_private_token_123456" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(mocks.verify).toHaveBeenCalledWith({
      requestFingerprint: `0x${"ab".repeat(32)}`,
      token: "synthetic_private_token_123456",
    });
  });

  it("does not accept a bearer token from the query string", async () => {
    const response = await POST(
      request(
        { token: "synthetic_private_token_123456" },
        "https://lozzi.test/api/verify?token=synthetic_query_token_123456",
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Query-string tokens are not accepted.",
    });
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("rejects non-JSON and oversized requests before token processing", async () => {
    const nonJson = await POST(
      new Request("https://lozzi.test/api/verify", {
        body: "synthetic_private_token_123456",
        headers: { "content-type": "text/plain" },
        method: "POST",
      }),
    );
    const oversized = await POST(
      new Request("https://lozzi.test/api/verify", {
        body: "{}",
        headers: {
          "content-length": "2048",
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(nonJson.status).toBe(415);
    expect(oversized.status).toBe(413);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("keeps malformed JSON details and body material out of logs", async () => {
    const sensitiveMarker = "synthetic_malformed_token_123456";
    const response = await POST(
      new Request("https://lozzi.test/api/verify", {
        body: `{"token":"${sensitiveMarker}"`,
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain(sensitiveMarker);
    expect(JSON.stringify(mocks.logEvent.mock.calls)).not.toContain(
      sensitiveMarker,
    );
  });

  it("never copies a rejected bearer token into logs or errors", async () => {
    const token = "synthetic_secret_token_123456";
    mocks.verify.mockRejectedValue(new Error(`provider rejected ${token}`));
    const response = await POST(request({ token }));
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).not.toContain(token);
    expect(JSON.stringify(mocks.logEvent.mock.calls)).not.toContain(token);
  });

  it("returns a bounded rate-limit response", async () => {
    mocks.verify.mockRejectedValue(
      new Error("Public verifier rate limit exceeded"),
    );
    const response = await POST(
      request({ token: "synthetic_private_token_123456" }),
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "Too many verification attempts. Try again later.",
    });
  });
});
