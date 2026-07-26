import "server-only";

import {
  sensitiveShareRevocationResultSchema,
  shareDisclosureScopeSchema,
  type ShareDisclosureScope,
} from "@lozzi/domain";

import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

import { z } from "zod";

interface SensitiveShareRpcClient {
  rpc(
    name: "revoke_sensitive_share_with_outbox",
    params: {
      p_correlation_id: string;
      p_idempotency_key: string;
      p_share_grant_id: string;
      p_trace_id: string;
    },
  ): Promise<{
    readonly data: unknown;
    readonly error: { readonly code?: string; readonly message?: string } | null;
  }>;
  rpc(
    name: "activate_sensitive_share_with_outbox",
    params: {
      p_commitment_environment: string;
      p_correlation_id: string;
      p_draft_id: string;
      p_grant_commitment: string;
      p_institution_commitment: string;
      p_institution_commitment_key_version: number;
      p_student_commitment: string;
      p_student_commitment_key_version: number;
      p_token_hash: string;
      p_trace_id: string;
    },
  ): Promise<{
    readonly data: unknown;
    readonly error: { readonly code?: string; readonly message?: string } | null;
  }>;
  rpc(
    name: "create_minimum_scope_share_draft",
    params: {
      p_academic_record_version_id: string;
      p_grant_duration_minutes: number;
      p_idempotency_key: string;
      p_recipient_label: string;
      p_scopes: string[];
      p_student_id: string;
    },
  ): Promise<{
    readonly data: unknown;
    readonly error: { readonly code?: string; readonly message?: string } | null;
  }>;
  rpc(
    name: "require_registrar_assisted_share_consent",
    params: {
      p_draft_id: string;
      p_student_id: string;
    },
  ): Promise<{
    readonly data: unknown;
    readonly error: { readonly code?: string; readonly message?: string } | null;
  }>;
}

const bytea = (value: `0x${string}`): string => {
  if (!/^0x[0-9a-fA-F]+$/u.test(value)) {
    throw new TypeError("Expected a hexadecimal bytea value");
  }
  return `\\x${value.slice(2)}`;
};

const draftResultSchema = z.object({
  draftExpiresAt: z.iso.datetime(),
  draftId: z.uuid(),
  grantDurationMinutes: z.union([z.literal(10), z.literal(15), z.literal(30)]),
  grantExpiresAt: z.iso.datetime(),
  scopes: z.array(shareDisclosureScopeSchema).min(1).max(4),
  status: z.literal("draft"),
});

const assistedResultSchema = z.object({
  draftId: z.uuid(),
  status: z.literal("assisted_consent_required"),
});

const activationResultSchema = z.object({
  chainStatus: z.literal("local_private").default("local_private"),
  draftId: z.uuid(),
  expiresAt: z.iso.datetime(),
  shareGrantId: z.uuid(),
  status: z.literal("active"),
});

export const createSensitiveShareDraft = async (input: {
  readonly academicRecordVersionId: string;
  readonly grantDurationMinutes: 10 | 15 | 30;
  readonly idempotencyKey: string;
  readonly recipientLabel: string;
  readonly scopes: ShareDisclosureScope[];
  readonly studentId: string;
}) => {
  const client = (await createClient()) as unknown as SensitiveShareRpcClient;
  const { data, error } = await client.rpc(
    "create_minimum_scope_share_draft",
    {
      p_academic_record_version_id: input.academicRecordVersionId,
      p_grant_duration_minutes: input.grantDurationMinutes,
      p_idempotency_key: input.idempotencyKey,
      p_recipient_label: input.recipientLabel,
      p_scopes: input.scopes,
      p_student_id: input.studentId,
    },
  );
  if (error) throw error;
  return draftResultSchema.parse(data);
};

export const requestRegistrarAssistedConsent = async (input: {
  readonly draftId: string;
  readonly studentId: string;
}) => {
  const client = createServiceClient() as unknown as SensitiveShareRpcClient;
  const { data, error } = await client.rpc(
    "require_registrar_assisted_share_consent",
    {
      p_draft_id: input.draftId,
      p_student_id: input.studentId,
    },
  );
  if (error) throw error;
  return assistedResultSchema.parse(data);
};

export const activateSensitiveShare = async (input: {
  readonly commitmentEnvironment:
    | "development"
    | "test"
    | "staging"
    | "production";
  readonly correlationId: string;
  readonly draftId: string;
  readonly grantCommitment: `0x${string}`;
  readonly institutionCommitment: `0x${string}`;
  readonly institutionCommitmentKeyVersion: number;
  readonly studentCommitment: `0x${string}`;
  readonly studentCommitmentKeyVersion: number;
  readonly tokenHash: `0x${string}`;
  readonly traceId: string;
}) => {
  const client =
    (await createClient()) as unknown as SensitiveShareRpcClient;
  const { data, error } = await client.rpc(
    "activate_sensitive_share_with_outbox",
    {
      p_commitment_environment: input.commitmentEnvironment,
      p_correlation_id: input.correlationId,
      p_draft_id: input.draftId,
      p_grant_commitment: bytea(input.grantCommitment),
      p_institution_commitment: bytea(input.institutionCommitment),
      p_institution_commitment_key_version:
        input.institutionCommitmentKeyVersion,
      p_student_commitment: bytea(input.studentCommitment),
      p_student_commitment_key_version: input.studentCommitmentKeyVersion,
      p_token_hash: bytea(input.tokenHash),
      p_trace_id: input.traceId,
    },
  );
  if (error) throw error;
  return activationResultSchema.parse(data);
};

export const revokeSensitiveShare = async (input: {
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly shareGrantId: string;
  readonly traceId: string;
}) => {
  const client =
    (await createClient()) as unknown as SensitiveShareRpcClient;
  const { data, error } = await client.rpc(
    "revoke_sensitive_share_with_outbox",
    {
      p_correlation_id: input.correlationId,
      p_idempotency_key: input.idempotencyKey,
      p_share_grant_id: input.shareGrantId,
      p_trace_id: input.traceId,
    },
  );
  if (error) throw error;
  return sensitiveShareRevocationResultSchema.parse(data);
};
