import { z } from "zod";

import { shareDisclosureScopeSchema } from "./outbox-events";

export const publicVerifierRequestSchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(20)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/u),
  })
  .strict();

const issuerSchema = z.object({ name: z.string().min(2).max(160) }).strict();
const timestampSchema = z.iso.datetime({ offset: true });

const disclosureSchema = z
  .object({
    "degree-progress": z
      .object({
        calculatedAt: timestampSchema,
        creditsEarned: z.number().nonnegative(),
        creditsRequired: z.number().positive(),
        progressPercent: z.number().min(0).max(100),
      })
      .strict()
      .optional(),
    "full-record": z
      .array(
        z
          .object({
            courseCode: z.string(),
            courseTitle: z.string(),
            creditHoursEarned: z.number().nonnegative(),
            gradeCode: z.string(),
            publishedAt: timestampSchema,
          })
          .strict(),
      )
      .optional(),
    program: z
      .object({
        credentialType: z.string(),
        name: z.string(),
      })
      .strict()
      .optional(),
    "record-summary": z
      .object({
        courseCount: z.number().int().nonnegative(),
        creditsEarned: z.number().nonnegative(),
        latestPublishedAt: timestampSchema.nullable(),
      })
      .strict()
      .optional(),
  })
  .strict();

const recordSchema = z
  .object({
    anchorStatus: z.enum(["not_configured", "pending", "confirmed", "failed"]),
    commitment: z.string().regex(/^0x[0-9a-f]{64}$/u),
    publishedAt: timestampSchema.nullable(),
    versionNumber: z.number().int().positive(),
  })
  .strict();

export const publicVerifierResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("invalid") }).strict(),
  z
    .object({
      expiresAt: timestampSchema,
      issuer: issuerSchema,
      status: z.enum(["expired", "revoked"]),
    })
    .strict(),
  z
    .object({
      disclosure: disclosureSchema,
      expiresAt: timestampSchema,
      issuer: issuerSchema,
      record: recordSchema,
      scopes: z.array(shareDisclosureScopeSchema).min(1).max(4),
      status: z.enum([
        "locally_verified",
        "pending_anchor",
        "chain_confirmed",
        "configuration_unavailable",
      ]),
    })
    .strict()
    .superRefine((result, context) => {
      const disclosed = Object.keys(result.disclosure);
      const authorized = new Set<string>(result.scopes);
      if (
        disclosed.length !== result.scopes.length ||
        disclosed.some((scope) => !authorized.has(scope))
      ) {
        context.addIssue({
          code: "custom",
          message: "Verifier disclosure does not match its authorized scopes",
        });
      }
    }),
]);

export type PublicVerifierResult = z.infer<typeof publicVerifierResultSchema>;
