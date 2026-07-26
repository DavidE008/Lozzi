import { z } from "zod";

import { shareDisclosureScopeSchema } from "./outbox-events";

export const sensitiveShareDurationMinutesSchema = z.union([
  z.literal(10),
  z.literal(15),
  z.literal(30),
]);

export const sensitiveShareChainStatusSchema = z.enum([
  "local_private",
  "anchoring_pending",
  "anchored",
  "anchor_failed",
  "revocation_pending",
  "revoked",
]);

export type SensitiveShareChainStatus = z.infer<
  typeof sensitiveShareChainStatusSchema
>;

export const sensitiveShareDraftInputSchema = z
  .object({
    expiryMinutes: sensitiveShareDurationMinutesSchema,
    recipientLabel: z.string().trim().min(2).max(120),
    scopes: z
      .array(shareDisclosureScopeSchema)
      .min(1)
      .max(4)
      .superRefine((scopes, context) => {
        if (new Set(scopes).size !== scopes.length) {
          context.addIssue({
            code: "custom",
            message: "Disclosure scopes must be unique",
          });
        }
      }),
  })
  .strict();

export type SensitiveShareDraftInput = z.infer<
  typeof sensitiveShareDraftInputSchema
>;

const databaseTimestampSchema = z.iso.datetime({ offset: true });

export const sensitiveShareRevocationResultSchema = z.discriminatedUnion(
  "status",
  [
    z
      .object({
        chainStatus: sensitiveShareChainStatusSchema,
        expiresAt: databaseTimestampSchema,
        idempotentReplay: z.literal(true),
        reconciliationQueued: z.literal(false),
        status: z.literal("expired"),
      })
      .strict(),
    z
      .object({
        chainStatus: sensitiveShareChainStatusSchema,
        idempotentReplay: z.boolean(),
        reconciliationQueued: z.boolean(),
        revokedAt: databaseTimestampSchema,
        shareGrantId: z.uuid(),
        status: z.literal("revoked"),
      })
      .strict(),
  ],
);

export type SensitiveShareRevocationResult = z.infer<
  typeof sensitiveShareRevocationResultSchema
>;
