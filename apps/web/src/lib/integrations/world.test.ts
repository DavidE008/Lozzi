import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { createWorldSignal, WORLD_PURPOSES } from "@lozzi/domain";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorldVerificationProvider } from "./world";

const environment = {
  NEXT_PUBLIC_WORLD_APP_ID: "app_example",
  WORLD_ID_ENVIRONMENT: "staging",
  WORLD_RP_ID: "rp_example",
  WORLD_RP_SIGNING_KEY: `0x${"11".repeat(32)}`,
};

const userId = "00000000-0000-4000-8000-000000000101";
const shareDraftId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const stubEnvironment = (worldEnvironment = "staging") => {
  Object.entries({
    ...environment,
    WORLD_ID_ENVIRONMENT: worldEnvironment,
  }).forEach(([name, value]) => vi.stubEnv(name, value));
};

const verifierSuccess = (input: {
  action: string;
  environment?: "production" | "sandbox" | "staging";
  identifier: string;
  nullifier?: string;
}) =>
  new Response(
    JSON.stringify({
      success: true,
      action: input.action,
      environment: input.environment ?? "staging",
      nullifier: input.nullifier ?? "0x2a",
      results: [
        {
          identifier: input.identifier,
          success: true,
          nullifier: input.nullifier ?? "0x2a",
        },
      ],
    }),
    {
      status: 200,
      headers: { "x-request-id": "world-request-synthetic" },
    },
  );

describe("World verification provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("creates purpose-specific short-lived requests", async () => {
    stubEnvironment();

    const account = await new WorldVerificationProvider().createRequest({
      authenticatedUserId: userId,
      purpose: "account-humanity",
    });
    const adult = await new WorldVerificationProvider().createRequest({
      authenticatedUserId: userId,
      purpose: "adult-share-consent",
      subjectId: shareDraftId,
    });

    expect(account).toMatchObject({
      action: WORLD_PURPOSES["account-humanity"].action,
      allowLegacyProofs: true,
      appId: "app_example",
      preset: { type: "proof-of-human" },
      requireUserPresence: false,
      rpContext: { rp_id: "rp_example" },
    });
    expect(adult).toMatchObject({
      action: WORLD_PURPOSES["adult-share-consent"].action,
      allowLegacyProofs: false,
      preset: {
        attributes: [{ type: "minimum_age", value: 18 }],
        type: "identity-check",
      },
      subjectId: shareDraftId,
    });
  });

  it("forwards the exact bounded JSON body and validates verifier evidence", async () => {
    stubEnvironment();
    const nonce = "synthetic-nonce";
    const proof = {
      protocol_version: "4.0",
      nonce,
      action: WORLD_PURPOSES["account-humanity"].action,
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
      user_presence_completed: false,
    };
    const rawBody = ` ${JSON.stringify(proof)}\n`;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        verifierSuccess({
          action: WORLD_PURPOSES["account-humanity"].action,
          identifier: "proof_of_human",
        }),
      );

    const result = await new WorldVerificationProvider().verify({
      authenticatedUserId: userId,
      expectedEnvironment: "staging",
      expectedNonce: nonce,
      purpose: "account-humanity",
      rawBody,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://developer.world.org/api/v4/verify/rp_example",
      expect.objectContaining({ body: rawBody }),
    );
    expect(result).toMatchObject({
      credentialType: "proof_of_human",
      nullifierDecimal: "42",
      presenceStatus: "not-requested",
      providerResponseId: "world-request-synthetic",
      purpose: "account-humanity",
    });
    expect(result).not.toHaveProperty("proof");
  });

  it("accepts a sandbox Selfie response bound to its share draft", async () => {
    stubEnvironment("sandbox");
    const nonce = "selfie-nonce";
    const proof = {
      protocol_version: "3.0",
      nonce,
      action: WORLD_PURPOSES["share-liveness"].action,
      environment: "sandbox",
      responses: [
        {
          identifier: "selfie",
          signal_hash: hashSignal(
            createWorldSignal(userId, "share-liveness", shareDraftId),
          ),
          proof: "0xproof",
          merkle_root: "0x01",
          nullifier: "0x2b",
        },
      ],
      user_presence_completed: false,
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      verifierSuccess({
        action: WORLD_PURPOSES["share-liveness"].action,
        environment: "sandbox",
        identifier: "selfie",
        nullifier: "0x2b",
      }),
    );

    const result = await new WorldVerificationProvider().verify({
      authenticatedUserId: userId,
      expectedEnvironment: "sandbox",
      expectedNonce: nonce,
      purpose: "share-liveness",
      rawBody: JSON.stringify(proof),
      subjectId: shareDraftId,
    });

    expect(result).toMatchObject({
      credentialType: "selfie",
      purpose: "share-liveness",
      subjectId: shareDraftId,
    });
  });

  it("requires a World ID 4 adult attestation without storing attributes", async () => {
    stubEnvironment();
    const nonce = "identity-nonce";
    const baseProof = {
      protocol_version: "4.0",
      nonce,
      action: WORLD_PURPOSES["adult-share-consent"].action,
      environment: "staging",
      responses: [
        {
          identifier: "passport",
          proof: ["0x01", "0x02", "0x03", "0x04", "0x05"],
          nullifier: "0x2c",
          issuer_schema_id: 9303,
          expires_at_min: 1_800_000_000,
        },
      ],
      user_presence_completed: false,
    };

    await expect(
      new WorldVerificationProvider().verify({
        authenticatedUserId: userId,
        expectedEnvironment: "staging",
        expectedNonce: nonce,
        purpose: "adult-share-consent",
        rawBody: JSON.stringify(baseProof),
        subjectId: shareDraftId,
      }),
    ).rejects.toMatchObject({ category: "integrity" });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      verifierSuccess({
        action: WORLD_PURPOSES["adult-share-consent"].action,
        identifier: "passport",
        nullifier: "0x2c",
      }),
    );
    const verified = await new WorldVerificationProvider().verify({
      authenticatedUserId: userId,
      expectedEnvironment: "staging",
      expectedNonce: nonce,
      purpose: "adult-share-consent",
      rawBody: JSON.stringify({ ...baseProof, identity_attested: true }),
      subjectId: shareDraftId,
    });

    expect(verified.identityAttested).toBe(true);
    expect(verified).not.toHaveProperty("attributes");
  });

  it("rejects challenge, signal, and verifier-response mismatches", async () => {
    stubEnvironment();
    const nonce = "expected-nonce";
    const proof = {
      protocol_version: "4.0",
      nonce,
      action: WORLD_PURPOSES["account-humanity"].action,
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
      user_presence_completed: false,
    };

    await expect(
      new WorldVerificationProvider().verify({
        authenticatedUserId: userId,
        expectedEnvironment: "staging",
        expectedNonce: nonce,
        purpose: "account-humanity",
        rawBody: JSON.stringify({ ...proof, nonce: "wrong-nonce" }),
      }),
    ).rejects.toMatchObject({ category: "integrity" });

    await expect(
      new WorldVerificationProvider().verify({
        authenticatedUserId: userId,
        expectedEnvironment: "staging",
        expectedNonce: nonce,
        purpose: "account-humanity",
        rawBody: JSON.stringify(proof),
      }),
    ).rejects.toMatchObject({ category: "integrity" });

    const validProof = {
      ...proof,
      responses: [
        {
          ...proof.responses[0],
          signal_hash: hashSignal(createWorldSignal(userId)),
        },
      ],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      verifierSuccess({
        action: WORLD_PURPOSES["share-liveness"].action,
        identifier: "proof_of_human",
      }),
    );
    await expect(
      new WorldVerificationProvider().verify({
        authenticatedUserId: userId,
        expectedEnvironment: "staging",
        expectedNonce: nonce,
        purpose: "account-humanity",
        rawBody: JSON.stringify(validProof),
      }),
    ).rejects.toMatchObject({ category: "invalid-response" });
  });
});
