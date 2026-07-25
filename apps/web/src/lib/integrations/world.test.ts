import { afterEach, describe, expect, it, vi } from "vitest";
import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { createWorldSignal, WORLD_ACTION } from "@lozzi/domain";

import { WorldVerificationProvider } from "./world";

const environment = {
  NEXT_PUBLIC_WORLD_APP_ID: "app_example",
  WORLD_ID_ENVIRONMENT: "staging",
  WORLD_RP_ID: "rp_example",
  WORLD_RP_SIGNING_KEY: `0x${"11".repeat(32)}`,
};

describe("World verification provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("creates a short-lived server-signed request", async () => {
    Object.entries(environment).forEach(([name, value]) =>
      vi.stubEnv(name, value),
    );
    const request = await new WorldVerificationProvider().createRequest(
      "00000000-0000-4000-8000-000000000101",
    );

    expect(request).toMatchObject({
      action: WORLD_ACTION,
      appId: "app_example",
      rpContext: { rp_id: "rp_example" },
    });
    expect(request.rpContext.expires_at).toBeGreaterThan(
      request.rpContext.created_at,
    );
  });

  it("forwards the exact proof and returns only scoped verification data", async () => {
    Object.entries(environment).forEach(([name, value]) =>
      vi.stubEnv(name, value),
    );
    const userId = "00000000-0000-4000-8000-000000000101";
    const proof = {
      protocol_version: "4.0",
      nonce: "synthetic-nonce",
      action: WORLD_ACTION,
      environment: "staging",
      responses: [
        {
          identifier: "proof_of_human",
          signal_hash: hashSignal(createWorldSignal(userId)),
          proof: ["0x01", "0x02", "0x03", "0x04", "0x05"],
          nullifier: "0x2a",
          issuer_schema_id: 1,
          expires_at_min: 1_800_000_000,
        },
      ],
      user_presence_completed: true,
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "x-request-id": "world-request-synthetic" },
        }),
      );

    const result = await new WorldVerificationProvider().verify({
      authenticatedUserId: userId,
      idkitResult: proof,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://developer.world.org/api/v4/verify/rp_example",
      expect.objectContaining({ body: JSON.stringify(proof) }),
    );
    expect(result).toMatchObject({
      credentialType: "proof_of_human",
      nullifierDecimal: "42",
      providerResponseId: "world-request-synthetic",
    });
    expect(result).not.toHaveProperty("proof");
  });

  it("rejects a proof bound to a different signed-in user", async () => {
    Object.entries(environment).forEach(([name, value]) =>
      vi.stubEnv(name, value),
    );

    await expect(
      new WorldVerificationProvider().verify({
        authenticatedUserId: "00000000-0000-4000-8000-000000000101",
        idkitResult: {
          protocol_version: "4.0",
          nonce: "synthetic-nonce",
          action: WORLD_ACTION,
          environment: "staging",
          responses: [
            {
              identifier: "proof_of_human",
              signal_hash: hashSignal(
                createWorldSignal("00000000-0000-4000-8000-000000000102"),
              ),
              proof: ["0x01"],
              nullifier: "0x2a",
            },
          ],
          user_presence_completed: true,
        },
      }),
    ).rejects.toMatchObject({ category: "integrity" });
  });
});
