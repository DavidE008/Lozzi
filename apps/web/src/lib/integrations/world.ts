import "server-only";

import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { signRequest } from "@worldcoin/idkit-core/signing";
import {
  createWorldSignal,
  normalizeWorldNullifier,
  WORLD_ACTION,
  worldRpContextSchema,
  worldVerificationSignalSchema,
  type VerificationProvider,
  type WorldVerificationSignal,
} from "@lozzi/domain";
import { z } from "zod";

import { getWorldConfig } from "./config";
import { PartnerIntegrationError } from "./errors";

const responseItemSchema = z
  .object({
    identifier: z.enum(["proof_of_human", "orb"]),
    nullifier: z.string().regex(/^0x[0-9a-fA-F]{1,64}$/u),
    proof: z.union([
      z.string().min(1),
      z.array(z.string().min(1)).min(1).max(8),
    ]),
    signal_hash: z.string().regex(/^0x[0-9a-fA-F]{1,64}$/u),
  })
  .passthrough();

const idKitResultSchema = z
  .object({
    action: z.literal(WORLD_ACTION),
    environment: z.enum(["production", "staging"]),
    nonce: z.string().min(1).max(160),
    protocol_version: z.enum(["3.0", "4.0"]),
    responses: z.array(responseItemSchema).min(1).max(8),
    user_presence_completed: z.boolean(),
  })
  .passthrough();

export type WorldIdKitResult = z.infer<typeof idKitResultSchema>;

export interface VerifiedWorldProof extends WorldVerificationSignal {
  readonly providerResponseId?: string;
}

const withTimeout = (): {
  readonly signal: AbortSignal;
  readonly cancel: () => void;
} => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeout),
  };
};

export class WorldVerificationProvider implements VerificationProvider {
  readonly capability = {
    name: "world" as const,
    status: "available" as const,
    label: "World verification",
    detail: "World ID 4.x server verification is configured.",
  };

  async createRequest(authenticatedUserId: string) {
    const config = getWorldConfig();
    const signed = signRequest({
      action: WORLD_ACTION,
      signingKeyHex: config.signingKey,
      ttl: 300,
    });

    return {
      action: WORLD_ACTION,
      appId: config.appId,
      environment: config.environment,
      rpContext: worldRpContextSchema.parse({
        rp_id: config.rpId,
        nonce: signed.nonce,
        created_at: signed.createdAt,
        expires_at: signed.expiresAt,
        signature: signed.sig,
      }),
      signal: createWorldSignal(authenticatedUserId),
    };
  }

  async verify(input: {
    readonly authenticatedUserId: string;
    readonly idkitResult: unknown;
  }): Promise<VerifiedWorldProof> {
    const config = getWorldConfig();
    const parsed = idKitResultSchema.safeParse(input.idkitResult);
    if (!parsed.success || parsed.data.environment !== config.environment) {
      throw new PartnerIntegrationError(
        "invalid-request",
        "The World proof response was not valid for this environment.",
      );
    }

    const expectedSignalHash = hashSignal(
      createWorldSignal(input.authenticatedUserId),
    ).toLowerCase();
    const proofResponse =
      parsed.data.responses.find(
        ({ identifier }) => identifier === "proof_of_human",
      ) ?? parsed.data.responses.find(({ identifier }) => identifier === "orb");

    if (
      !proofResponse ||
      BigInt(proofResponse.signal_hash) !== BigInt(expectedSignalHash)
    ) {
      throw new PartnerIntegrationError(
        "integrity",
        "The World proof was not bound to this signed-in account.",
      );
    }

    const timeout = withTimeout();
    let response: Response;
    try {
      response = await fetch(
        `https://developer.world.org/api/v4/verify/${config.rpId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input.idkitResult),
          cache: "no-store",
          signal: timeout.signal,
        },
      );
    } finally {
      timeout.cancel();
    }

    if (!response.ok) {
      throw new PartnerIntegrationError(
        response.status === 429 ? "rate-limited" : "invalid-response",
        "World could not verify this proof.",
      );
    }

    return {
      ...worldVerificationSignalSchema.parse({
        action: WORLD_ACTION,
        credentialType: proofResponse.identifier,
        nullifierDecimal: normalizeWorldNullifier(proofResponse.nullifier),
        signalHash: `0x${BigInt(proofResponse.signal_hash)
          .toString(16)
          .padStart(64, "0")}`,
        verifiedAt: new Date().toISOString(),
      }),
      providerResponseId:
        response.headers.get("x-request-id") ??
        response.headers.get("world-request-id") ??
        undefined,
    };
  }
}

export const createWorldVerificationProvider = () =>
  new WorldVerificationProvider();
