import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  getAuthenticatedUser: vi.fn(),
  logEvent: vi.fn(),
  revokeSensitiveShare: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));
vi.mock("@/lib/integrations/sensitive-shares", () => ({
  revokeSensitiveShare: mocks.revokeSensitiveShare,
}));
vi.mock("@/lib/logging", () => ({ logEvent: mocks.logEvent }));
vi.mock("@/lib/security/origin", () => ({
  assertSameOrigin: mocks.assertSameOrigin,
}));

import { POST } from "./route";

const shareGrantId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const idempotencyKey = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const request = () =>
  new Request(`https://lozzi.test/api/student/shares/${shareGrantId}/revoke`, {
    headers: { "idempotency-key": idempotencyKey },
    method: "POST",
  });
const context = (id = shareGrantId) => ({
  params: Promise.resolve({ shareGrantId: id }),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedUser.mockResolvedValue({ id: "student-user" });
});

describe("POST /api/student/shares/[shareGrantId]/revoke", () => {
  it("requires an authenticated same-origin request", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue(null);

    const response = await POST(request(), context());

    expect(response.status).toBe(401);
    expect(mocks.assertSameOrigin).toHaveBeenCalledOnce();
    expect(mocks.revokeSensitiveShare).not.toHaveBeenCalled();
  });

  it("passes a stable idempotency key to the authenticated transaction boundary", async () => {
    mocks.revokeSensitiveShare.mockResolvedValue({
      chainStatus: "local_private",
      idempotentReplay: false,
      reconciliationQueued: true,
      revokedAt: "2026-07-26T04:00:00+00:00",
      shareGrantId,
      status: "revoked",
    });

    const response = await POST(request(), context());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.revokeSensitiveShare).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey,
        shareGrantId,
      }),
    );
  });

  it("rejects malformed grant identifiers before the database boundary", async () => {
    const response = await POST(request(), context("not-a-grant"));

    expect(response.status).toBe(400);
    expect(mocks.revokeSensitiveShare).not.toHaveBeenCalled();
  });

  it("never copies provider details into the response or structured log", async () => {
    const sensitiveMarker = "synthetic-bearer-token";
    mocks.revokeSensitiveShare.mockRejectedValue(
      new Error(`provider rejected ${sensitiveMarker}`),
    );

    const response = await POST(request(), context());
    const body = await response.text();

    expect(body).not.toContain(sensitiveMarker);
    expect(JSON.stringify(mocks.logEvent.mock.calls)).not.toContain(
      sensitiveMarker,
    );
  });
});
