import { keccak256, stringToHex } from "viem";
import { normalize } from "viem/ens";
import { z } from "zod";

export const WORLD_ACTION = "lozzi-student-verification";
export const PROGRESS_EXPLANATION_DISCLAIMER =
  "Advisory explanation only. Official requirements are determined by the institution.";

const bytes32Schema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/u, "Expected a 32-byte hexadecimal value");

export const integrationFailureCategorySchema = z.enum([
  "configuration",
  "authentication",
  "authorization",
  "invalid-request",
  "invalid-response",
  "network",
  "rate-limited",
  "timeout",
  "provider-unavailable",
  "replay",
  "integrity",
  "unknown",
]);

export type IntegrationFailureCategory = z.infer<
  typeof integrationFailureCategorySchema
>;

export const worldRpContextSchema = z
  .object({
    rp_id: z.string().regex(/^rp_[A-Za-z0-9_]+$/u),
    nonce: bytes32Schema,
    created_at: z.number().int().nonnegative(),
    expires_at: z.number().int().positive(),
    signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/u),
  })
  .strict()
  .refine(({ created_at, expires_at }) => expires_at > created_at, {
    message: "World RP context must expire after it is created",
  });

export type WorldRpContext = z.infer<typeof worldRpContextSchema>;

export const worldCredentialTypeSchema = z.enum(["proof_of_human", "orb"]);

export type WorldCredentialType = z.infer<typeof worldCredentialTypeSchema>;

export const worldVerificationSignalSchema = z
  .object({
    action: z.literal(WORLD_ACTION),
    credentialType: worldCredentialTypeSchema,
    nullifierDecimal: z.string().regex(/^(0|[1-9][0-9]*)$/u),
    signalHash: bytes32Schema,
    verifiedAt: z.iso.datetime(),
  })
  .strict();

export type WorldVerificationSignal = z.infer<
  typeof worldVerificationSignalSchema
>;

export const createWorldSignal = (
  authenticatedUserId: string,
  action = WORLD_ACTION,
): `0x${string}` =>
  keccak256(
    stringToHex(
      ["LOZZI_WORLD_SIGNAL_V1", action, authenticatedUserId].join("\u0000"),
    ),
  );

export const normalizeWorldNullifier = (value: string): string => {
  if (!/^0x[0-9a-fA-F]{1,64}$/u.test(value)) {
    throw new TypeError("World nullifier must be a 256-bit hexadecimal value");
  }
  return BigInt(value).toString(10);
};

export const normalizeEnsName = (candidate: string): string => {
  const trimmed = candidate.trim();
  if (!trimmed) throw new TypeError("ENS name is required");
  return normalize(trimmed);
};

export const ensResolutionSchema = z
  .object({
    address: z.string().regex(/^0x[0-9a-fA-F]{40}$/u),
    name: z.string().min(1).max(255).nullable(),
    network: z.literal("ethereum-sepolia"),
    resolvedAt: z.iso.datetime(),
  })
  .strict();

export type EnsResolution = z.infer<typeof ensResolutionSchema>;

export const privateObjectMetadataSchema = z
  .object({
    additionalDataCommitment: bytes32Schema,
    ciphertextCommitment: bytes32Schema,
    encryptionMode: z.literal("aes-256-gcm"),
    iv: z.string().regex(/^0x[0-9a-fA-F]{24}$/u),
    objectType: z.enum([
      "academic-record-snapshot",
      "degree-audit-context",
      "progress-explanation",
      "record-sharing-package",
      "transcript-document",
    ]),
    wrappingKeyReference: z.string().min(1).max(255),
  })
  .strict();

export type PrivateObjectMetadata = z.infer<typeof privateObjectMetadataSchema>;

export const progressExplanationInputSchema = z
  .object({
    creditsEarned: z.number().int().nonnegative(),
    creditsRequired: z.number().int().positive(),
    currentGpa: z.number().min(0).max(4).nullable(),
    programName: z.string().min(1).max(160),
    programVersion: z.string().min(1).max(80),
    requirements: z
      .array(
        z
          .object({
            code: z.string().min(1).max(40),
            credits: z.number().int().nonnegative().nullable(),
            status: z.enum(["complete", "in-progress", "remaining"]),
          })
          .strict(),
      )
      .max(64),
  })
  .strict();

export type ProgressExplanationInput = z.infer<
  typeof progressExplanationInputSchema
>;

export const progressExplanationSchema = z
  .object({
    disclaimer: z.literal(PROGRESS_EXPLANATION_DISCLAIMER),
    possibleNextCourses: z
      .array(
        z
          .object({
            courseCode: z.string().min(1).max(40),
            reason: z.string().min(1).max(500),
            requiresAdvisorReview: z.boolean(),
          })
          .strict(),
      )
      .max(5),
    progressHighlights: z.array(z.string().min(1).max(300)).max(6),
    risks: z.array(z.string().min(1).max(300)).max(6),
    summary: z.string().min(1).max(1200),
  })
  .strict();

export type ProgressExplanation = z.infer<typeof progressExplanationSchema>;
