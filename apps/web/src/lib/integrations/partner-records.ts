import type {
  IntegrationFailureCategory,
  WorldVerificationSignal,
} from "@lozzi/domain";

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
}

const bytea = (value: string): string => {
  if (!/^0x[0-9a-fA-F]+$/u.test(value)) {
    throw new TypeError("Expected a hexadecimal bytea value");
  }
  return `\\x${value.slice(2)}`;
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
