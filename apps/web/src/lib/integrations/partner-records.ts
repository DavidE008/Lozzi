import type {
  IntegrationFailureCategory,
  PrivateObjectMetadata,
  WorldVerificationSignal,
} from "@lozzi/domain";
import { namehash } from "viem";
import { z } from "zod";

import { createServiceClient } from "@/lib/supabase/service";

interface PartnerRpcClient {
  rpc(
    name: "record_world_verification",
    params: {
      p_action_id: string;
      p_credential_type: string;
      p_idempotency_key: string;
      p_nullifier: string;
      p_provider_response_id: string | null;
      p_signal_hash: string;
      p_student_id: string;
      p_verified_at: string;
    },
  ): Promise<{
    readonly data: unknown;
    readonly error: { readonly code?: string } | null;
  }>;
  rpc(
    name: "record_ens_identity",
    params: {
      p_idempotency_key: string;
      p_name_hash: string;
      p_parent_name: string;
      p_public_name: string;
      p_resolved_address: string;
      p_resolver_address: string | null;
      p_student_id: string;
      p_student_wallet_id: string;
      p_transaction_hash: string | null;
    },
  ): Promise<{
    readonly data: unknown;
    readonly error: { readonly code?: string } | null;
  }>;
  rpc(
    name: "set_integration_capability",
    params: {
      p_detail: string;
      p_error_category: IntegrationFailureCategory | null;
      p_evidence_reference: string | null;
      p_institution_id: string;
      p_provider: string;
      p_state: string;
    },
  ): Promise<{
    readonly data: unknown;
    readonly error: { readonly code?: string } | null;
  }>;
  rpc(
    name: "record_zero_g_object",
    params: {
      p_additional_data_commitment: string;
      p_ciphertext_commitment: string;
      p_idempotency_key: string;
      p_iv: string;
      p_object_reference: string;
      p_object_type: PrivateObjectMetadata["objectType"];
      p_root_hash: string;
      p_size_bytes: number;
      p_student_id: string;
      p_transaction_hash: string | null;
      p_wrapping_key_reference: string;
    },
  ): Promise<{
    readonly data: unknown;
    readonly error: { readonly code?: string } | null;
  }>;
  rpc(
    name: "start_ai_progress_run",
    params: {
      p_idempotency_key: string;
      p_input_zero_g_object_id: string;
      p_model: string;
      p_provider: "zero-g-router";
      p_request_commitment: string;
      p_student_id: string;
      p_verification_mode: string;
    },
  ): Promise<{
    readonly data: unknown;
    readonly error: { readonly code?: string } | null;
  }>;
  rpc(
    name: "complete_ai_progress_run",
    params: {
      p_error_category: IntegrationFailureCategory | null;
      p_output_zero_g_object_id: string | null;
      p_provider_request_id: string | null;
      p_response_commitment: string | null;
      p_run_id: string;
      p_schema_validation_status: "failed" | "invalid" | "valid";
    },
  ): Promise<{
    readonly data: unknown;
    readonly error: { readonly code?: string } | null;
  }>;
}

const idResultSchema = (property: "objectId" | "runId") =>
  z.object({ [property]: z.uuid() });

const bytea = (value: string): string => {
  if (!/^0x[0-9a-fA-F]+$/u.test(value)) {
    throw new TypeError("Expected a hexadecimal bytea value");
  }
  return `\\x${value.slice(2)}`;
};

export const recordEnsIdentity = async (input: {
  readonly idempotencyKey: string;
  readonly name: string;
  readonly parentName: string;
  readonly studentId: string;
  readonly studentWalletId: string;
  readonly transactionHash?: `0x${string}`;
  readonly walletAddress: `0x${string}`;
}): Promise<void> => {
  const client = createServiceClient() as unknown as PartnerRpcClient;
  const { error } = await client.rpc("record_ens_identity", {
    p_idempotency_key: input.idempotencyKey,
    p_name_hash: bytea(namehash(input.name)),
    p_parent_name: input.parentName,
    p_public_name: input.name,
    p_resolved_address: bytea(input.walletAddress),
    p_resolver_address: null,
    p_student_id: input.studentId,
    p_student_wallet_id: input.studentWalletId,
    p_transaction_hash: input.transactionHash
      ? bytea(input.transactionHash)
      : null,
  });
  if (error) throw error;
};

export const recordWorldVerification = async (
  input: WorldVerificationSignal & {
    readonly idempotencyKey: string;
    readonly providerResponseId?: string;
    readonly studentId: string;
  },
): Promise<void> => {
  const client = createServiceClient() as unknown as PartnerRpcClient;
  const { error } = await client.rpc("record_world_verification", {
    p_action_id: input.action,
    p_credential_type: input.credentialType,
    p_idempotency_key: input.idempotencyKey,
    p_nullifier: input.nullifierDecimal,
    p_provider_response_id: input.providerResponseId ?? null,
    p_signal_hash: bytea(input.signalHash),
    p_student_id: input.studentId,
    p_verified_at: input.verifiedAt,
  });
  if (error) throw error;
};

export const recordZeroGObject = async (input: {
  readonly idempotencyKey: string;
  readonly metadata: PrivateObjectMetadata;
  readonly objectReference: string;
  readonly rootHash: `0x${string}`;
  readonly sizeBytes: number;
  readonly studentId: string;
  readonly transactionHash?: `0x${string}`;
}): Promise<string> => {
  const client = createServiceClient() as unknown as PartnerRpcClient;
  const { data, error } = await client.rpc("record_zero_g_object", {
    p_additional_data_commitment: bytea(
      input.metadata.additionalDataCommitment,
    ),
    p_ciphertext_commitment: bytea(input.metadata.ciphertextCommitment),
    p_idempotency_key: input.idempotencyKey,
    p_iv: bytea(input.metadata.iv),
    p_object_reference: input.objectReference,
    p_object_type: input.metadata.objectType,
    p_root_hash: bytea(input.rootHash),
    p_size_bytes: input.sizeBytes,
    p_student_id: input.studentId,
    p_transaction_hash: input.transactionHash
      ? bytea(input.transactionHash)
      : null,
    p_wrapping_key_reference: input.metadata.wrappingKeyReference,
  });
  if (error) throw error;
  return idResultSchema("objectId").parse(data).objectId;
};

export const startAiProgressRun = async (input: {
  readonly idempotencyKey: string;
  readonly inputObjectId: string;
  readonly model: string;
  readonly requestCommitment: `0x${string}`;
  readonly studentId: string;
  readonly verificationMode: string;
}): Promise<string> => {
  const client = createServiceClient() as unknown as PartnerRpcClient;
  const { data, error } = await client.rpc("start_ai_progress_run", {
    p_idempotency_key: input.idempotencyKey,
    p_input_zero_g_object_id: input.inputObjectId,
    p_model: input.model,
    p_provider: "zero-g-router",
    p_request_commitment: bytea(input.requestCommitment),
    p_student_id: input.studentId,
    p_verification_mode: input.verificationMode,
  });
  if (error) throw error;
  return idResultSchema("runId").parse(data).runId;
};

export const completeAiProgressRun = async (input: {
  readonly errorCategory: IntegrationFailureCategory | null;
  readonly outputObjectId: string | null;
  readonly providerRequestId: string | null;
  readonly responseCommitment: `0x${string}` | null;
  readonly runId: string;
  readonly validationStatus: "failed" | "invalid" | "valid";
}): Promise<void> => {
  const client = createServiceClient() as unknown as PartnerRpcClient;
  const { error } = await client.rpc("complete_ai_progress_run", {
    p_error_category: input.errorCategory,
    p_output_zero_g_object_id: input.outputObjectId,
    p_provider_request_id: input.providerRequestId,
    p_response_commitment: input.responseCommitment
      ? bytea(input.responseCommitment)
      : null,
    p_run_id: input.runId,
    p_schema_validation_status: input.validationStatus,
  });
  if (error) throw error;
};

export const recordCapabilityState = async (input: {
  readonly detail: string;
  readonly errorCategory: IntegrationFailureCategory | null;
  readonly evidenceReference: string | null;
  readonly institutionId: string;
  readonly provider: "world" | "ens" | "zero-g";
  readonly state: "available" | "failed";
}): Promise<void> => {
  const client = createServiceClient() as unknown as PartnerRpcClient;
  const { error } = await client.rpc("set_integration_capability", {
    p_detail: input.detail,
    p_error_category: input.errorCategory,
    p_evidence_reference: input.evidenceReference,
    p_institution_id: input.institutionId,
    p_provider: input.provider,
    p_state: input.state,
  });
  if (error) throw error;
};
