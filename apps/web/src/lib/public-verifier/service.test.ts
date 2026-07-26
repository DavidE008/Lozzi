import { describe, expect, it, vi } from "vitest";

import { verifyPublicShare } from "./service";

const evidence = {
  grantCommitment: `0x${"11".repeat(32)}`,
  institutionCommitment: `0x${"22".repeat(32)}`,
  recordCommitment: `0x${"33".repeat(32)}`,
  studentCommitment: `0x${"44".repeat(32)}`,
};

const allowedPayload = {
  disclosure: {
    "record-summary": {
      courseCount: 2,
      creditsEarned: 6,
      latestPublishedAt: "2026-07-26T12:00:00.000Z",
    },
  },
  expiresAt: "2026-07-26T12:30:00.000Z",
  issuer: { name: "Northstar University" },
  record: {
    anchorStatus: "not_configured",
    commitment: `0x${"33".repeat(32)}`,
    publishedAt: "2026-07-26T12:00:00.000Z",
    versionNumber: 2,
  },
  registryEvidence: evidence,
  scopes: ["record-summary"],
  status: "locally_verified",
};

const rpcClient = (data: unknown) => ({
  rpc: vi.fn().mockResolvedValue({ data, error: null }),
});

describe("verifyPublicShare", () => {
  it("hashes the bearer token before the database boundary", async () => {
    const client = rpcClient(allowedPayload);
    const token = "synthetic_private_token_123456";
    const result = await verifyPublicShare(
      {
        requestFingerprint: `0x${"ab".repeat(32)}`,
        token,
      },
      { rpcClient: client },
    );

    expect(result.status).toBe("locally_verified");
    expect(JSON.stringify(client.rpc.mock.calls)).not.toContain(token);
    expect(client.rpc).toHaveBeenCalledWith(
      "verify_record_share",
      expect.objectContaining({
        p_request_fingerprint_hash: `\\x${"ab".repeat(32)}`,
        p_token_hash: expect.stringMatching(/^\\x[0-9a-f]{64}$/u),
      }),
    );
    expect(result).not.toHaveProperty("registryEvidence");
  });

  it("promotes a reconciled grant only after independent registry readback", async () => {
    const reader = {
      verifyShareGrant: vi
        .fn()
        .mockResolvedValue({ status: "chain-confirmed" }),
    };
    const result = await verifyPublicShare(
      {
        requestFingerprint: `0x${"ab".repeat(32)}`,
        token: "synthetic_private_token_123456",
      },
      {
        createRegistryReader: () => reader,
        rpcClient: rpcClient({
          ...allowedPayload,
          record: { ...allowedPayload.record, anchorStatus: "confirmed" },
          status: "chain_check_required",
        }),
      },
    );

    expect(result.status).toBe("chain_confirmed");
    expect(reader.verifyShareGrant).toHaveBeenCalledWith({
      expiresAt: allowedPayload.expiresAt,
      ...evidence,
    });
  });

  it("fails closed when chain evidence is missing or inconsistent", async () => {
    const result = await verifyPublicShare(
      {
        requestFingerprint: `0x${"ab".repeat(32)}`,
        token: "synthetic_private_token_123456",
      },
      {
        createRegistryReader: () => ({
          verifyShareGrant: vi.fn().mockRejectedValue(new Error("wrong chain")),
        }),
        rpcClient: rpcClient({
          ...allowedPayload,
          record: { ...allowedPayload.record, anchorStatus: "confirmed" },
          status: "chain_check_required",
        }),
      },
    );

    expect(result.status).toBe("configuration_unavailable");
  });

  it("rejects a database disclosure that escalates beyond its frozen scopes", async () => {
    await expect(
      verifyPublicShare(
        {
          requestFingerprint: `0x${"ab".repeat(32)}`,
          token: "synthetic_private_token_123456",
        },
        {
          rpcClient: rpcClient({
            ...allowedPayload,
            disclosure: {
              ...allowedPayload.disclosure,
              program: {
                credentialType: "bachelors",
                name: "Computer Science",
              },
            },
          }),
        },
      ),
    ).rejects.toThrow("authorized scopes");
  });
});
