import "server-only";

import type { IntegrationFailureCategory } from "@lozzi/domain";
import { z } from "zod";

import { createServiceClient } from "@/lib/supabase/service";

interface RpcResult {
  readonly data: unknown;
  readonly error: { readonly code?: string; readonly message?: string } | null;
}

interface EnsRpcClient {
  rpc(name: string, params: Record<string, unknown>): Promise<RpcResult>;
}

const bytea = (value: `0x${string}`): string => {
  if (!/^0x[0-9a-fA-F]+$/u.test(value)) {
    throw new TypeError("Expected a hexadecimal bytea value");
  }
  return `\\x${value.slice(2)}`;
};

const hexadecimalFromBytea = (value: string): `0x${string}` => {
  if (!/^\\x[0-9a-fA-F]+$/u.test(value)) {
    throw new TypeError("Expected a PostgreSQL hexadecimal bytea value");
  }
  return `0x${value.slice(2)}`;
};

const hexadecimalFromEncodedJson = (value: string): `0x${string}` => {
  if (!/^[0-9a-fA-F]+$/u.test(value)) {
    throw new TypeError("Expected an encoded hexadecimal value");
  }
  return `0x${value}`;
};

const challengeResultSchema = z.object({
  challengeId: z.uuid(),
  expiresAt: z.iso.datetime(),
});

const walletResultSchema = z.object({
  address: z.string().regex(/^[0-9a-fA-F]{40}$/u),
  status: z.literal("verified"),
  verifiedAt: z.iso.datetime(),
  walletId: z.uuid(),
});

export interface StoredWalletLinkChallenge {
  readonly address: `0x${string}`;
  readonly challengeId: string;
  readonly domain: string;
  readonly expiresAt: string;
  readonly issuedAt: string;
  readonly messageHash: `0x${string}`;
  readonly nonceHash: `0x${string}`;
  readonly uri: string;
}

export const createWalletLinkChallengeRecord = async (input: {
  readonly address: `0x${string}`;
  readonly challengeId: string;
  readonly domain: string;
  readonly expiresAt: string;
  readonly issuedAt: string;
  readonly messageHash: `0x${string}`;
  readonly nonceHash: `0x${string}`;
  readonly studentId: string;
  readonly uri: string;
}): Promise<{ readonly challengeId: string; readonly expiresAt: string }> => {
  const client = createServiceClient() as unknown as EnsRpcClient;
  const { data, error } = await client.rpc("create_wallet_link_challenge", {
    p_address: bytea(input.address),
    p_challenge_id: input.challengeId,
    p_domain: input.domain,
    p_expires_at: input.expiresAt,
    p_issued_at: input.issuedAt,
    p_message_hash: bytea(input.messageHash),
    p_nonce_hash: bytea(input.nonceHash),
    p_student_id: input.studentId,
    p_uri: input.uri,
  });
  if (error) throw error;
  return challengeResultSchema.parse(data);
};

export const getWalletLinkChallengeRecord = async (
  challengeId: string,
  studentId: string,
): Promise<StoredWalletLinkChallenge | null> => {
  const client = createServiceClient();
  const { data, error } = await client
    .from("wallet_link_challenges" as never)
    .select(
      "id, address, nonce_hash, message_hash, domain, uri, issued_at, expires_at, consumed_at",
    )
    .eq("id", challengeId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as {
    readonly address: string;
    readonly consumed_at: string | null;
    readonly domain: string;
    readonly expires_at: string;
    readonly id: string;
    readonly issued_at: string;
    readonly message_hash: string;
    readonly nonce_hash: string;
    readonly uri: string;
  };
  if (row.consumed_at || new Date(row.expires_at) <= new Date()) return null;

  return {
    address: hexadecimalFromBytea(row.address),
    challengeId: row.id,
    domain: row.domain,
    expiresAt: row.expires_at,
    issuedAt: row.issued_at,
    messageHash: hexadecimalFromBytea(row.message_hash),
    nonceHash: hexadecimalFromBytea(row.nonce_hash),
    uri: row.uri,
  };
};

export const consumeWalletLinkChallengeRecord = async (input: {
  readonly address: `0x${string}`;
  readonly challengeId: string;
  readonly messageHash: `0x${string}`;
  readonly studentId: string;
  readonly verifiedAt: string;
}): Promise<{
  readonly address: `0x${string}`;
  readonly verifiedAt: string;
  readonly walletId: string;
}> => {
  const client = createServiceClient() as unknown as EnsRpcClient;
  const { data, error } = await client.rpc("consume_wallet_link_challenge", {
    p_address: bytea(input.address),
    p_challenge_id: input.challengeId,
    p_message_hash: bytea(input.messageHash),
    p_student_id: input.studentId,
    p_verified_at: input.verifiedAt,
  });
  if (error) throw error;
  const result = walletResultSchema.parse(data);
  return {
    address: `0x${result.address}`,
    verifiedAt: result.verifiedAt,
    walletId: result.walletId,
  };
};

export const ensOperationStatusSchema = z.enum([
  "pending",
  "submitting",
  "submitted",
  "confirmed",
  "active",
  "failed",
  "revocation-pending",
  "revoked",
]);

export type EnsOperationStatus = z.infer<typeof ensOperationStatusSchema>;

const operationResultSchema = z.object({
  name: z.string().min(1).nullable().optional(),
  operationId: z.uuid(),
  requestId: z.uuid().nullable().optional(),
  requestKey: z.string().regex(/^[0-9a-fA-F]{64}$/u).nullable().optional(),
  status: ensOperationStatusSchema,
  submissionAuthorized: z.boolean().optional(),
  transactionHash: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/u)
    .nullable()
    .optional(),
});

export interface EnsIssuanceOperation {
  readonly adapterAddress: `0x${string}`;
  readonly confirmationCount: number | null;
  readonly confirmedBlockNumber: bigint | null;
  readonly name: string;
  readonly operationId: string;
  readonly parentName: string;
  readonly requestId: string;
  readonly requestKey: `0x${string}`;
  readonly resolvedAddress: `0x${string}`;
  readonly resolverAddress: `0x${string}` | null;
  readonly status: EnsOperationStatus;
  readonly studentId: string;
  readonly studentWalletId: string;
  readonly submittedAt: string | null;
  readonly transactionHash: `0x${string}` | null;
}

export interface EnsOperationReference {
  readonly name: string | null;
  readonly operationId: string;
  readonly requestId: string | null;
  readonly requestKey: `0x${string}` | null;
  readonly status: EnsOperationStatus;
  readonly submissionAuthorized: boolean;
  readonly transactionHash: `0x${string}` | null;
}

const parseOperationResult = (value: unknown) => {
  const result = operationResultSchema.parse(value);
  return {
    name: result.name ?? null,
    operationId: result.operationId,
    requestId: result.requestId ?? null,
    requestKey: result.requestKey
      ? hexadecimalFromEncodedJson(result.requestKey)
      : null,
    status: result.status,
    submissionAuthorized: result.submissionAuthorized ?? false,
    transactionHash: result.transactionHash
      ? hexadecimalFromEncodedJson(result.transactionHash)
      : null,
  };
};

export const reserveEnsIssuance = async (input: {
  readonly adapterAddress: `0x${string}`;
  readonly consentedAt: string;
  readonly labelHash: `0x${string}`;
  readonly name: string;
  readonly nameHash: `0x${string}`;
  readonly parentName: string;
  readonly requestId: string;
  readonly requestKey: `0x${string}`;
  readonly studentId: string;
  readonly studentWalletId: string;
  readonly walletAddress: `0x${string}`;
}) => {
  const client = createServiceClient() as unknown as EnsRpcClient;
  const { data, error } = await client.rpc("reserve_ens_issuance", {
    p_adapter_address: bytea(input.adapterAddress),
    p_consented_at: input.consentedAt,
    p_label_hash: bytea(input.labelHash),
    p_name_hash: bytea(input.nameHash),
    p_parent_name: input.parentName,
    p_public_name: input.name,
    p_request_id: input.requestId,
    p_request_key: bytea(input.requestKey),
    p_resolved_address: bytea(input.walletAddress),
    p_student_id: input.studentId,
    p_student_wallet_id: input.studentWalletId,
  });
  if (error) throw error;
  return parseOperationResult(data);
};

export const beginEnsIssuanceSubmission = async (
  operationId: string,
  requestId: string,
) => {
  const client = createServiceClient() as unknown as EnsRpcClient;
  const { data, error } = await client.rpc("begin_ens_issuance_submission", {
    p_operation_id: operationId,
    p_request_id: requestId,
  });
  if (error) throw error;
  return parseOperationResult(data);
};

export const markEnsIssuanceSubmitted = async (input: {
  readonly operationId: string;
  readonly requestId: string;
  readonly submittedAt: string;
  readonly transactionHash: `0x${string}`;
}) => {
  const client = createServiceClient() as unknown as EnsRpcClient;
  const { data, error } = await client.rpc("mark_ens_issuance_submitted", {
    p_operation_id: input.operationId,
    p_request_id: input.requestId,
    p_submitted_at: input.submittedAt,
    p_transaction_hash: bytea(input.transactionHash),
  });
  if (error) throw error;
  return parseOperationResult(data);
};

export const finalizeEnsIssuance = async (input: {
  readonly confirmationCount: number;
  readonly confirmedAt: string;
  readonly confirmedBlockNumber: bigint;
  readonly operationId: string;
  readonly requestId: string;
  readonly resolvedAddress: `0x${string}`;
  readonly resolverAddress: `0x${string}`;
  readonly transactionHash: `0x${string}`;
}) => {
  const client = createServiceClient() as unknown as EnsRpcClient;
  const { data, error } = await client.rpc("finalize_ens_issuance", {
    p_confirmation_count: input.confirmationCount,
    p_confirmed_at: input.confirmedAt,
    p_confirmed_block_number: input.confirmedBlockNumber.toString(),
    p_operation_id: input.operationId,
    p_request_id: input.requestId,
    p_resolved_address: bytea(input.resolvedAddress),
    p_resolver_address: bytea(input.resolverAddress),
    p_transaction_hash: bytea(input.transactionHash),
  });
  if (error) throw error;
  return parseOperationResult(data);
};

export const failEnsIssuanceReservation = async (input: {
  readonly errorCategory: IntegrationFailureCategory;
  readonly operationId: string;
  readonly requestId: string;
}) => {
  const client = createServiceClient() as unknown as EnsRpcClient;
  const { data, error } = await client.rpc("fail_ens_issuance_reservation", {
    p_error_category: input.errorCategory,
    p_operation_id: input.operationId,
    p_request_id: input.requestId,
  });
  if (error) throw error;
  return parseOperationResult(data);
};

const toOperation = (row: {
  readonly adapter_address: string;
  readonly confirmation_count: number | null;
  readonly confirmed_block_number: number | string | null;
  readonly id: string;
  readonly parent_name: string;
  readonly public_name: string;
  readonly request_id: string;
  readonly request_key: string;
  readonly resolved_address: string;
  readonly resolver_address: string | null;
  readonly status: string;
  readonly student_id: string;
  readonly student_wallet_id: string;
  readonly submitted_at: string | null;
  readonly transaction_hash: string | null;
}): EnsIssuanceOperation => ({
  adapterAddress: hexadecimalFromBytea(row.adapter_address),
  confirmationCount: row.confirmation_count,
  confirmedBlockNumber:
    row.confirmed_block_number === null
      ? null
      : BigInt(row.confirmed_block_number),
  name: row.public_name,
  operationId: row.id,
  parentName: row.parent_name,
  requestId: row.request_id,
  requestKey: hexadecimalFromBytea(row.request_key),
  resolvedAddress: hexadecimalFromBytea(row.resolved_address),
  resolverAddress: row.resolver_address
    ? hexadecimalFromBytea(row.resolver_address)
    : null,
  status: ensOperationStatusSchema.parse(row.status),
  studentId: row.student_id,
  studentWalletId: row.student_wallet_id,
  submittedAt: row.submitted_at,
  transactionHash: row.transaction_hash
    ? hexadecimalFromBytea(row.transaction_hash)
    : null,
});

const operationColumns =
  "id, student_id, student_wallet_id, request_id, request_key, public_name, parent_name, resolved_address, adapter_address, resolver_address, transaction_hash, status, submitted_at, confirmed_block_number, confirmation_count";

export const getEnsIssuanceOperation = async (
  operationId: string,
): Promise<EnsIssuanceOperation | null> => {
  const client = createServiceClient();
  const { data, error } = await client
    .from("ens_identities")
    .select(operationColumns)
    .eq("id", operationId)
    .not("request_id", "is", null)
    .maybeSingle();
  if (error) throw error;
  return data
    ? toOperation(data as unknown as Parameters<typeof toOperation>[0])
    : null;
};

export const listReconcilableEnsOperations = async (
  limit = 10,
): Promise<readonly EnsIssuanceOperation[]> => {
  const client = createServiceClient();
  const { data, error } = await client
    .from("ens_identities")
    .select(operationColumns)
    .in("status", ["submitting", "submitted", "confirmed"])
    .not("request_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 25));
  if (error) throw error;
  return (data ?? []).map((row) =>
    toOperation(row as unknown as Parameters<typeof toOperation>[0]),
  );
};

export interface PendingEnsRevocation {
  readonly name: string;
  readonly operationId: string;
}

export const listPendingEnsRevocations = async (
  limit = 10,
): Promise<readonly PendingEnsRevocation[]> => {
  const client = createServiceClient();
  const { data, error } = await client
    .from("ens_identities")
    .select("id, public_name")
    .eq("status", "revocation-pending")
    .not("public_name", "is", null)
    .order("revocation_requested_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 25));
  if (error) throw error;
  return (data ?? []).map((row) => {
    const parsed = z
      .object({ id: z.uuid(), public_name: z.string().min(1) })
      .parse(row);
    return { name: parsed.public_name, operationId: parsed.id };
  });
};

export const finalizeEnsRevocation = async (
  operationId: string,
  verifiedAt: string,
) => {
  const client = createServiceClient() as unknown as EnsRpcClient;
  const { data, error } = await client.rpc("finalize_ens_revocation", {
    p_observed_address: null,
    p_operation_id: operationId,
    p_verified_at: verifiedAt,
  });
  if (error) throw error;
  return z
    .object({
      operationId: z.uuid(),
      status: z.literal("revoked"),
    })
    .parse(data);
};

export const revokeStudentWalletRecord = async (
  studentId: string,
  walletId: string,
) => {
  const client = createServiceClient() as unknown as EnsRpcClient;
  const { data, error } = await client.rpc("revoke_student_wallet", {
    p_student_id: studentId,
    p_student_wallet_id: walletId,
  });
  if (error) throw error;
  return z
    .object({
      ensClearRequired: z.boolean(),
      ensOperationId: z.uuid().nullable(),
      status: z.literal("revoked"),
      walletId: z.uuid(),
    })
    .parse(data);
};
