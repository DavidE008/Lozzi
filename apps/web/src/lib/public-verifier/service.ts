import "server-only";

import { createHash } from "node:crypto";

import {
  publicVerifierResultSchema,
  type PublicVerifierResult,
} from "@lozzi/domain";
import { z } from "zod";

import { WorldChainRegistryAdapter } from "@/lib/integrations/registry-adapter";
import { createServiceClient } from "@/lib/supabase/service";

interface PublicVerifierRpcClient {
  rpc(
    name: "verify_record_share",
    params: {
      p_request_fingerprint_hash: string;
      p_token_hash: string;
    },
  ): Promise<{
    readonly data: unknown;
    readonly error: { readonly code?: string; readonly message?: string } | null;
  }>;
}

interface ShareRegistryReader {
  verifyShareGrant(input: {
    readonly expiresAt: string;
    readonly grantCommitment: `0x${string}`;
    readonly institutionCommitment: `0x${string}`;
    readonly recordCommitment: `0x${string}`;
    readonly studentCommitment: `0x${string}`;
  }): Promise<{ readonly status: "chain-confirmed" }>;
}

const bytes32Schema = z
  .string()
  .regex(/^0x[0-9a-f]{64}$/u)
  .transform((value) => value as `0x${string}`);

const registryEvidenceSchema = z
  .object({
    grantCommitment: bytes32Schema.nullable(),
    institutionCommitment: bytes32Schema.nullable(),
    recordCommitment: bytes32Schema,
    studentCommitment: bytes32Schema.nullable(),
  })
  .strict();

const rpcEnvelopeSchema = z
  .object({
    registryEvidence: registryEvidenceSchema.optional(),
    status: z.string(),
  })
  .passthrough();

const bytea = (value: `0x${string}`): string => `\\x${value.slice(2)}`;

const tokenHash = (token: string): `0x${string}` =>
  `0x${createHash("sha256").update(token, "utf8").digest("hex")}`;

export const verifyPublicShare = async (
  input: {
    readonly requestFingerprint: `0x${string}`;
    readonly token: string;
  },
  dependencies: {
    readonly createRegistryReader?: () => ShareRegistryReader;
    readonly rpcClient?: PublicVerifierRpcClient;
  } = {},
): Promise<PublicVerifierResult> => {
  const client =
    dependencies.rpcClient ??
    (createServiceClient() as unknown as PublicVerifierRpcClient);
  const { data, error } = await client.rpc("verify_record_share", {
    p_request_fingerprint_hash: bytea(input.requestFingerprint),
    p_token_hash: bytea(tokenHash(input.token)),
  });
  if (error) throw error;

  const envelope = rpcEnvelopeSchema.parse(data);
  const { registryEvidence, ...publicPayload } = envelope;
  if (envelope.status !== "chain_check_required") {
    return publicVerifierResultSchema.parse(publicPayload);
  }

  const evidence = registryEvidenceSchema.parse(registryEvidence);
  const unavailable = {
    ...publicPayload,
    status: "configuration_unavailable",
  };
  if (
    !evidence.grantCommitment ||
    !evidence.institutionCommitment ||
    !evidence.studentCommitment
  ) {
    return publicVerifierResultSchema.parse(unavailable);
  }

  try {
    const reader =
      dependencies.createRegistryReader?.() ??
      new WorldChainRegistryAdapter();
    await reader.verifyShareGrant({
      expiresAt: z.string().parse(publicPayload.expiresAt),
      grantCommitment: evidence.grantCommitment,
      institutionCommitment: evidence.institutionCommitment,
      recordCommitment: evidence.recordCommitment,
      studentCommitment: evidence.studentCommitment,
    });
    return publicVerifierResultSchema.parse({
      ...publicPayload,
      status: "chain_confirmed",
    });
  } catch {
    return publicVerifierResultSchema.parse(unavailable);
  }
};
