import { describe, expect, it, vi } from "vitest";

import { hashAgentKitNonce } from "./commitments";
import {
  agentRequestStorage,
  createAgentRequestState,
  SupabaseAgentKitStorage,
} from "./storage";

const config = {
  agentAddress: "0x1111111111111111111111111111111111111111",
  appUrl: "http://localhost:3000",
  facilitatorUrl: "https://facilitator.example",
  humanIdHmacKey: Buffer.alloc(32, 5).toString("base64"),
  worldChainRpcUrl: "https://worldchain.example",
};

const payloadHeader = (input: {
  readonly address?: string;
  readonly nonce?: string;
}) =>
  Buffer.from(
    JSON.stringify({
      address:
        input.address ?? "0x1111111111111111111111111111111111111111",
      chainId: "eip155:480",
      domain: "localhost:3000",
      expirationTime: new Date(Date.now() + 5 * 60 * 1_000).toISOString(),
      issuedAt: new Date().toISOString(),
      nonce: input.nonce ?? "synthetic-nonce",
      resources: [
        "http://localhost:3000/api/agentkit/degree-plan/context",
      ],
      signature: `0x${"11".repeat(65)}`,
      statement: "Propose a Lozzi degree plan",
      type: "eip191",
      uri: "http://localhost:3000/api/agentkit/degree-plan/context",
      version: "1",
    }),
  ).toString("base64");

describe("SupabaseAgentKitStorage", () => {
  it("atomically binds SDK usage to a delegation, nonce, and committed human", async () => {
    const authorize = vi.fn().mockResolvedValue({
      delegationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      institutionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      scope: "degree-plan:read",
      studentId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      usageCount: 1,
      usageLimit: 3,
    });
    const storage = new SupabaseAgentKitStorage(config, {
      authorize,
      hasNonce: vi.fn().mockResolvedValue(false),
    });
    const state = createAgentRequestState({
      agentkitHeader: payloadHeader({}),
      authorizationHeader: `Bearer ${"a".repeat(43)}`,
      endpoint: "/api/agentkit/degree-plan/context",
    });

    await agentRequestStorage.run(state, async () => {
      expect(await storage.hasUsedNonce("synthetic-nonce")).toBe(false);
      await storage.recordNonce("synthetic-nonce");
      expect(
        await storage.tryIncrementUsage(
          "/api/agentkit/degree-plan/context",
          "anonymous-human-id",
          3,
        ),
      ).toBe(true);
    });

    expect(authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "/api/agentkit/degree-plan/context",
        nonceHash: hashAgentKitNonce("synthetic-nonce"),
        scope: "degree-plan:read",
      }),
    );
    const call = authorize.mock.calls[0]?.[0];
    expect(call.humanIdCommitment).toMatch(/^0x[0-9a-f]{64}$/u);
    expect(JSON.stringify(call)).not.toContain("anonymous-human-id");
  });

  it("rejects a replay or resource mismatch without consuming scope", async () => {
    const authorize = vi.fn();
    const storage = new SupabaseAgentKitStorage(config, {
      authorize,
      hasNonce: vi.fn().mockResolvedValue(true),
    });
    const state = createAgentRequestState({
      agentkitHeader: payloadHeader({ nonce: "replayed-nonce" }),
      authorizationHeader: `Bearer ${"b".repeat(43)}`,
      endpoint: "/api/agentkit/degree-plan/context",
    });

    await agentRequestStorage.run(state, async () => {
      expect(await storage.hasUsedNonce("replayed-nonce")).toBe(true);
      await storage.recordNonce("replayed-nonce");
      expect(
        await storage.tryIncrementUsage(
          "/api/agentkit/degree-plan/proposals",
          "anonymous-human-id",
          3,
        ),
      ).toBe(false);
    });
    expect(authorize).not.toHaveBeenCalled();
  });

  it("rejects an unbound nonce and non-three-use configuration", async () => {
    const authorize = vi.fn();
    const storage = new SupabaseAgentKitStorage(config, {
      authorize,
      hasNonce: vi.fn().mockResolvedValue(false),
    });
    const state = createAgentRequestState({
      agentkitHeader: payloadHeader({}),
      authorizationHeader: `Bearer ${"c".repeat(43)}`,
      endpoint: "/api/agentkit/degree-plan/context",
    });

    await agentRequestStorage.run(state, async () => {
      await expect(storage.recordNonce("other-nonce")).rejects.toThrow(
        /not bound/u,
      );
      expect(
        await storage.tryIncrementUsage(
          "/api/agentkit/degree-plan/context",
          "anonymous-human-id",
          2,
        ),
      ).toBe(false);
    });
    expect(authorize).not.toHaveBeenCalled();
  });
});
