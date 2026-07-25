import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

import { z } from "zod";

interface SensitiveShareRpcClient {
  rpc(
    name: "activate_sensitive_share",
    params: {
      p_draft_id: string;
      p_grant_commitment: string;
      p_student_id: string;
      p_token_hash: string;
    },
  ): Promise<{
    readonly data: unknown;
    readonly error: { readonly code?: string; readonly message?: string } | null;
  }>;
  rpc(
    name: "create_sensitive_share_draft",
    params: {
      p_academic_record_version_id: string;
      p_grant_expires_at: string;
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
  grantExpiresAt: z.iso.datetime(),
  status: z.literal("draft"),
});

const assistedResultSchema = z.object({
  draftId: z.uuid(),
  status: z.literal("assisted_consent_required"),
});

const activationResultSchema = z.object({
  draftId: z.uuid(),
  expiresAt: z.iso.datetime(),
  shareGrantId: z.uuid(),
  status: z.literal("active"),
});

export const createSensitiveShareDraft = async (input: {
  readonly academicRecordVersionId: string;
  readonly grantExpiresAt: string;
  readonly idempotencyKey: string;
  readonly recipientLabel: string;
  readonly scopes: string[];
  readonly studentId: string;
}) => {
  const client = createServiceClient() as unknown as SensitiveShareRpcClient;
  const { data, error } = await client.rpc("create_sensitive_share_draft", {
    p_academic_record_version_id: input.academicRecordVersionId,
    p_grant_expires_at: input.grantExpiresAt,
    p_idempotency_key: input.idempotencyKey,
    p_recipient_label: input.recipientLabel,
    p_scopes: input.scopes,
    p_student_id: input.studentId,
  });
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
  readonly draftId: string;
  readonly grantCommitment: `0x${string}`;
  readonly studentId: string;
  readonly tokenHash: `0x${string}`;
}) => {
  const client = createServiceClient() as unknown as SensitiveShareRpcClient;
  const { data, error } = await client.rpc("activate_sensitive_share", {
    p_draft_id: input.draftId,
    p_grant_commitment: bytea(input.grantCommitment),
    p_student_id: input.studentId,
    p_token_hash: bytea(input.tokenHash),
  });
  if (error) throw error;
  return activationResultSchema.parse(data);
};
