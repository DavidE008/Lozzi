import { z } from "zod";

export const outboxEventTypeSchema = z.enum([
  "academic_record.anchor.requested.v1",
  "share_grant.create.requested.v1",
  "share_grant.revoke.requested.v1",
]);

export const shareDisclosureScopeSchema = z.enum([
  "program",
  "degree-progress",
  "record-summary",
  "full-record",
]);

const bytes32Schema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/u, "Expected a 32-byte hex value");

const algorithmSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/u);

const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(160)
  .regex(/^[A-Za-z0-9._:-]+$/u);

const attemptMetadataSchema = z
  .object({
    attemptCount: z.number().int().min(0).max(100),
    firstAttemptAt: z.iso.datetime().nullable(),
    lastAttemptAt: z.iso.datetime().nullable(),
    nextAttemptAt: z.iso.datetime().nullable(),
  })
  .strict();

const envelopeSchema = z
  .object({
    aggregateId: z.uuid(),
    correlationId: z.uuid(),
    eventId: z.uuid(),
    idempotencyKey: idempotencyKeySchema,
    institutionId: z.uuid(),
    occurredAt: z.iso.datetime(),
    schemaVersion: z.literal(1),
    traceId: z.uuid(),
    attempt: attemptMetadataSchema,
  })
  .strict();

const commitmentIdentitySchema = z
  .object({
    institutionCommitment: bytes32Schema,
    institutionCommitmentAlgorithm: algorithmSchema,
    institutionCommitmentKeyVersion: z.number().int().min(1).max(2_147_483_647),
    studentCommitment: bytes32Schema,
    studentCommitmentAlgorithm: algorithmSchema,
    studentCommitmentKeyVersion: z.number().int().min(1).max(2_147_483_647),
  })
  .strict();

const disclosureScopesSchema = z
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
  });

export const academicRecordAnchorRequestedV1Schema = envelopeSchema
  .extend({
    eventType: z.literal("academic_record.anchor.requested.v1"),
    payload: commitmentIdentitySchema
      .extend({
        academicRecordVersionId: z.uuid(),
        recordCommitment: bytes32Schema,
        recordCommitmentAlgorithm: algorithmSchema,
      })
      .strict(),
  })
  .strict();

export const shareGrantCreateRequestedV1Schema = envelopeSchema
  .extend({
    eventType: z.literal("share_grant.create.requested.v1"),
    payload: commitmentIdentitySchema
      .extend({
        academicRecordVersionId: z.uuid(),
        expiresAt: z.iso.datetime(),
        grantCommitment: bytes32Schema,
        scopes: disclosureScopesSchema,
        shareGrantId: z.uuid(),
      })
      .strict(),
  })
  .strict();

export const shareGrantRevokeRequestedV1Schema = envelopeSchema
  .extend({
    eventType: z.literal("share_grant.revoke.requested.v1"),
    payload: commitmentIdentitySchema
      .extend({
        grantCommitment: bytes32Schema,
        revokedAt: z.iso.datetime(),
        shareGrantId: z.uuid(),
      })
      .strict(),
  })
  .strict();

export const outboxEventSchema = z.discriminatedUnion("eventType", [
  academicRecordAnchorRequestedV1Schema,
  shareGrantCreateRequestedV1Schema,
  shareGrantRevokeRequestedV1Schema,
]);

export type AcademicRecordAnchorRequestedV1 = z.infer<
  typeof academicRecordAnchorRequestedV1Schema
>;
export type OutboxEvent = z.infer<typeof outboxEventSchema>;
export type OutboxEventType = z.infer<typeof outboxEventTypeSchema>;
export type ShareDisclosureScope = z.infer<typeof shareDisclosureScopeSchema>;
export type ShareGrantCreateRequestedV1 = z.infer<
  typeof shareGrantCreateRequestedV1Schema
>;
export type ShareGrantRevokeRequestedV1 = z.infer<
  typeof shareGrantRevokeRequestedV1Schema
>;
