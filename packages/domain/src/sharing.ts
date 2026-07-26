import { z } from "zod";

import { shareDisclosureScopeSchema } from "./outbox-events";

export const sensitiveShareDurationMinutesSchema = z.union([
  z.literal(10),
  z.literal(15),
  z.literal(30),
]);

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
