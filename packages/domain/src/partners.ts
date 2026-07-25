import { keccak256, stringToHex } from "viem";
import { normalize } from "viem/ens";
import { z } from "zod";

export const worldPurposeSchema = z.enum([
  "account-humanity",
  "share-liveness",
  "adult-share-consent",
]);

export type WorldPurpose = z.infer<typeof worldPurposeSchema>;

export const WORLD_PURPOSES = {
  "account-humanity": {
    action: "lozzi-student-verification",
    allowLegacyProofs: true,
    identityAttestationRequired: false,
    preset: "proof-of-human",
    protocol: "3-or-4",
    requireSubject: false,
    requireUserPresence: false,
    signalRequired: true,
  },
  "share-liveness": {
    action: "lozzi-sensitive-share-selfie-check",
    allowLegacyProofs: true,
    identityAttestationRequired: false,
    preset: "selfie-check-legacy",
    protocol: "3",
    requireSubject: true,
    requireUserPresence: false,
    signalRequired: true,
  },
  "adult-share-consent": {
    action: "lozzi-adult-share-consent",
    allowLegacyProofs: false,
    identityAttestationRequired: true,
    preset: "identity-check",
    protocol: "4",
    requireSubject: true,
    requireUserPresence: false,
    signalRequired: false,
  },
} as const satisfies Record<
  WorldPurpose,
  {
    readonly action: string;
    readonly allowLegacyProofs: boolean;
    readonly identityAttestationRequired: boolean;
    readonly preset:
      "proof-of-human" | "selfie-check-legacy" | "identity-check";
    readonly protocol: "3" | "4" | "3-or-4";
    readonly requireSubject: boolean;
    readonly requireUserPresence: boolean;
    readonly signalRequired: boolean;
  }
>;

export const WORLD_ACTION = WORLD_PURPOSES["account-humanity"].action;
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

export const worldCredentialTypeSchema = z.enum([
  "proof_of_human",
  "orb",
  "selfie",
  "passport",
  "mnc",
]);

export type WorldCredentialType = z.infer<typeof worldCredentialTypeSchema>;

export const worldVerificationSignalSchema = z
  .object({
    action: z.string().min(1).max(255),
    challengeId: z.uuid().nullable(),
    credentialType: worldCredentialTypeSchema,
    identityAttested: z.boolean(),
    nullifierDecimal: z.string().regex(/^(0|[1-9][0-9]*)$/u),
    presenceStatus: z.enum(["completed", "not-requested"]),
    protocolVersion: z.enum(["3.0", "4.0"]),
    purpose: worldPurposeSchema,
    signalHash: bytes32Schema.nullable(),
    subjectId: z.uuid().nullable(),
    verifiedAt: z.iso.datetime(),
  })
  .strict();

export type WorldVerificationSignal = z.infer<
  typeof worldVerificationSignalSchema
>;

export const worldPurposeRequestSchema = z
  .object({
    purpose: worldPurposeSchema,
    subjectId: z.uuid().optional(),
  })
  .strict()
  .superRefine(({ purpose, subjectId }, context) => {
    const definition = WORLD_PURPOSES[purpose];
    if (definition.requireSubject && !subjectId) {
      context.addIssue({
        code: "custom",
        message: `World purpose ${purpose} requires a subject`,
        path: ["subjectId"],
      });
    }
    if (!definition.requireSubject && subjectId) {
      context.addIssue({
        code: "custom",
        message: `World purpose ${purpose} does not accept a subject`,
        path: ["subjectId"],
      });
    }
  });

export type WorldPurposeRequest = z.infer<typeof worldPurposeRequestSchema>;

export const createWorldSignal = (
  authenticatedUserId: string,
  purpose: WorldPurpose = "account-humanity",
  subjectId?: string,
): `0x${string}` =>
  keccak256(
    stringToHex(
      [
        "LOZZI_WORLD_SIGNAL_V2",
        purpose,
        WORLD_PURPOSES[purpose].action,
        authenticatedUserId,
        subjectId ?? "",
      ].join("\u0000"),
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
