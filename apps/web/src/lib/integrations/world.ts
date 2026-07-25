import "server-only";

import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { signRequest } from "@worldcoin/idkit-core/signing";
import {
  createWorldSignal,
  normalizeWorldNullifier,
  WORLD_PURPOSES,
  worldPurposeRequestSchema,
  worldRpContextSchema,
  worldVerificationSignalSchema,
  type VerificationProvider,
  type WorldPurpose,
  type WorldVerificationRequest,
  type WorldVerificationSignal,
} from "@lozzi/domain";
import { z } from "zod";

import { getWorldConfig } from "./config";
import { PartnerIntegrationError } from "./errors";

const MAX_WORLD_RESULT_BYTES = 64 * 1024;

const hexadecimalSchema = z.string().regex(/^0x[0-9a-fA-F]{1,64}$/u);

const responseItemSchema = z
  .object({
    identifier: z.enum([
      "proof_of_human",
      "orb",
      "selfie",
      "passport",
      "mnc",
    ]),
    nullifier: hexadecimalSchema,
    proof: z.union([
      z.string().min(1),
      z.array(z.string().min(1)).min(1).max(8),
    ]),
    signal_hash: hexadecimalSchema.optional(),
  })
  .passthrough();

const idKitResultSchema = z
  .object({
    action: z.string().min(1).max(255),
    environment: z.enum(["production", "sandbox", "staging"]),
    identity_attested: z.boolean().optional(),
    nonce: z.string().min(1).max(160),
    protocol_version: z.enum(["3.0", "4.0"]),
    responses: z.array(responseItemSchema).min(1).max(8),
    user_presence_completed: z.boolean(),
  })
  .passthrough();

const verifierResultItemSchema = z
  .object({
    identifier: z.string().min(1).max(80),
    nullifier: hexadecimalSchema,
    success: z.literal(true),
  })
  .passthrough();

const verifierResponseSchema = z
  .object({
    action: z.string().min(1).max(255),
    environment: z.enum(["production", "sandbox", "staging"]),
    nullifier: hexadecimalSchema.optional(),
    results: z.array(verifierResultItemSchema).min(1).max(8),
    success: z.literal(true),
  })
  .passthrough();

const expectedIdentifiers: Readonly<
  Record<WorldPurpose, readonly z.infer<typeof responseItemSchema>["identifier"][]>
> = {
  "account-humanity": ["proof_of_human", "orb"],
  "share-liveness": ["selfie"],
  "adult-share-consent": ["passport", "mnc"],
};

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

const parseRawIdKitResult = (rawBody: string): WorldIdKitResult => {
  if (
    rawBody.length === 0 ||
    new TextEncoder().encode(rawBody).byteLength > MAX_WORLD_RESULT_BYTES
  ) {
    throw new PartnerIntegrationError(
      "invalid-request",
      "The World proof response was empty or too large.",
    );
  }

  try {
    return idKitResultSchema.parse(JSON.parse(rawBody) as unknown);
  } catch {
    throw new PartnerIntegrationError(
      "invalid-request",
      "The World proof response was not valid JSON.",
    );
  }
};

const normalizeSignalHash = (value: string): `0x${string}` =>
  `0x${BigInt(value).toString(16).padStart(64, "0")}`;

type CreateRequestInput = Parameters<VerificationProvider["createRequest"]>[0];
type VerifyInput = Parameters<VerificationProvider["verify"]>[0];

export class WorldVerificationProvider implements VerificationProvider {
  readonly capability = {
    name: "world" as const,
    status: "available" as const,
    label: "World verification",
    detail: "Purpose-bound World ID server verification is configured.",
  };

  async createRequest(
    normalizedInput: CreateRequestInput,
  ): Promise<WorldVerificationRequest> {
    const parsedInput = worldPurposeRequestSchema.parse({
      purpose: normalizedInput.purpose,
      subjectId: normalizedInput.subjectId,
    });
    const definition = WORLD_PURPOSES[parsedInput.purpose];
    const config = getWorldConfig();
    const signed = signRequest({
      action: definition.action,
      signingKeyHex: config.signingKey,
      ttl: 300,
    });
    const signal = createWorldSignal(
      normalizedInput.authenticatedUserId,
      parsedInput.purpose,
      parsedInput.subjectId,
    );

    return {
      action: definition.action,
      allowLegacyProofs: definition.allowLegacyProofs,
      appId: config.appId,
      environment: config.environment,
      preset:
        parsedInput.purpose === "adult-share-consent"
          ? {
              attributes: [{ type: "minimum_age", value: 18 }],
              type: "identity-check",
            }
          : parsedInput.purpose === "share-liveness"
            ? { type: "selfie-check-legacy" }
            : { type: "proof-of-human" },
      purpose: parsedInput.purpose,
      requireUserPresence: definition.requireUserPresence,
      rpContext: worldRpContextSchema.parse({
        rp_id: config.rpId,
        nonce: signed.nonce,
        created_at: signed.createdAt,
        expires_at: signed.expiresAt,
        signature: signed.sig,
      }),
      signal,
      ...(parsedInput.subjectId ? { subjectId: parsedInput.subjectId } : {}),
    };
  }

  async verify(normalizedInput: VerifyInput): Promise<VerifiedWorldProof> {
    const config = getWorldConfig();
    const definition = WORLD_PURPOSES[normalizedInput.purpose];
    const parsed = parseRawIdKitResult(normalizedInput.rawBody);

    if (
      parsed.action !== definition.action ||
      parsed.environment !== normalizedInput.expectedEnvironment ||
      parsed.environment !== config.environment ||
      parsed.nonce !== normalizedInput.expectedNonce
    ) {
      throw new PartnerIntegrationError(
        "integrity",
        "The World proof did not match its one-time challenge.",
      );
    }

    if (
      (definition.protocol === "3" && parsed.protocol_version !== "3.0") ||
      (definition.protocol === "4" && parsed.protocol_version !== "4.0") ||
      (definition.identityAttestationRequired &&
        parsed.identity_attested !== true)
    ) {
      throw new PartnerIntegrationError(
        "integrity",
        "The World proof did not satisfy the requested credential policy.",
      );
    }

    const allowedIdentifiers = expectedIdentifiers[normalizedInput.purpose];
    const proofResponse = parsed.responses.find(({ identifier }) =>
      allowedIdentifiers.includes(identifier),
    );
    if (!proofResponse) {
      throw new PartnerIntegrationError(
        "integrity",
        "The World proof used the wrong credential.",
      );
    }

    const expectedSignalHash = hashSignal(
      createWorldSignal(
        normalizedInput.authenticatedUserId,
        normalizedInput.purpose,
        normalizedInput.subjectId,
      ),
    ).toLowerCase();
    if (
      (definition.signalRequired && !proofResponse.signal_hash) ||
      (proofResponse.signal_hash &&
        BigInt(proofResponse.signal_hash) !== BigInt(expectedSignalHash))
    ) {
      throw new PartnerIntegrationError(
        "integrity",
        "The World proof was not bound to the intended Lozzi workflow.",
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
          body: normalizedInput.rawBody,
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

    const verifierResponse = verifierResponseSchema.safeParse(
      await response.json(),
    );
    if (
      !verifierResponse.success ||
      verifierResponse.data.action !== definition.action ||
      verifierResponse.data.environment !== normalizedInput.expectedEnvironment
    ) {
      throw new PartnerIntegrationError(
        "invalid-response",
        "World returned proof evidence for a different request.",
      );
    }

    const successfulResult = verifierResponse.data.results.find(
      (result) =>
        result.identifier === proofResponse.identifier &&
        BigInt(result.nullifier) === BigInt(proofResponse.nullifier),
    );
    if (
      !successfulResult ||
      (verifierResponse.data.nullifier &&
        BigInt(verifierResponse.data.nullifier) !==
          BigInt(proofResponse.nullifier))
    ) {
      throw new PartnerIntegrationError(
        "invalid-response",
        "World did not confirm the selected credential result.",
      );
    }

    return {
      ...worldVerificationSignalSchema.parse({
        action: definition.action,
        challengeId: normalizedInput.challengeId ?? null,
        credentialType: proofResponse.identifier,
        identityAttested: parsed.identity_attested === true,
        nullifierDecimal: normalizeWorldNullifier(proofResponse.nullifier),
        presenceStatus: parsed.user_presence_completed
          ? "completed"
          : "not-requested",
        protocolVersion: parsed.protocol_version,
        purpose: normalizedInput.purpose,
        signalHash: proofResponse.signal_hash
          ? normalizeSignalHash(proofResponse.signal_hash)
          : null,
        subjectId: normalizedInput.subjectId ?? null,
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
