import "server-only";

import { z } from "zod";

import { toPostgresBytea, type Bytes32 } from "@/lib/agentkit/commitments";
import { createServiceClient } from "@/lib/supabase/service";

interface AgentKitRpcClient {
  from(name: "agentkit_nonces"): {
    select(
      columns: "nonce_hash",
      options: { count: "exact"; head: true },
    ): {
      eq(
        column: "nonce_hash",
        value: string,
      ): Promise<{
        readonly count: number | null;
        readonly error: { readonly code?: string; readonly message?: string } | null;
      }>;
    };
  };
  rpc(
    name: "authorize_agent_delegation_scope",
    params: {
      p_agent_address_commitment: string;
      p_endpoint: AgentKitEndpoint;
      p_human_id_commitment: string;
      p_nonce_expires_at: string;
      p_nonce_hash: string;
      p_scope: AgentKitScope;
      p_token_hash: string;
    },
  ): Promise<RpcResult>;
  rpc(
    name: "create_degree_plan_delegation",
    params: {
      p_expires_at: string;
      p_idempotency_key: string;
      p_student_id: string;
      p_token_hash: string;
    },
  ): Promise<RpcResult>;
  rpc(
    name: "get_agent_degree_plan_context",
    params: {
      p_delegation_id: string;
      p_human_id_commitment: string;
      p_student_id: string;
    },
  ): Promise<RpcResult>;
  rpc(
    name: "submit_degree_plan_proposal",
    params: {
      p_course_codes: string[];
      p_delegation_id: string;
      p_human_id_commitment: string;
      p_student_id: string;
      p_summary: string;
    },
  ): Promise<RpcResult>;
}

interface RpcResult {
  readonly data: unknown;
  readonly error: { readonly code?: string; readonly message?: string } | null;
}

export type AgentKitEndpoint =
  | "/api/agentkit/degree-plan/context"
  | "/api/agentkit/degree-plan/proposals";
export type AgentKitScope = "degree-plan:read" | "degree-plan:propose";

const delegationSchema = z.object({
  delegationId: z.uuid(),
  expiresAt: z.iso.datetime(),
  scopes: z.tuple([
    z.literal("degree-plan:read"),
    z.literal("degree-plan:propose"),
  ]),
  status: z.literal("active"),
});

const authorizationSchema = z.object({
  delegationId: z.uuid(),
  endpoint: z.string().optional(),
  institutionId: z.uuid(),
  scope: z.enum(["degree-plan:read", "degree-plan:propose"]),
  studentId: z.uuid(),
  usageCount: z.number().int().min(1).max(3),
  usageLimit: z.literal(3),
});

const degreePlanContextSchema = z.object({
  requirements: z
    .array(
      z.object({
        completed: z.boolean(),
        courseCode: z.string().min(1).max(40),
        eligible: z.boolean(),
      }),
    )
    .max(100),
});

const proposalSchema = z.object({
  proposalId: z.uuid(),
  reviewRequired: z.literal(true),
  status: z.literal("pending"),
});

const client = () => createServiceClient() as unknown as AgentKitRpcClient;

export const hasAgentKitNonce = async (nonceHash: Bytes32) => {
  const { count, error } = await client()
    .from("agentkit_nonces")
    .select("nonce_hash", { count: "exact", head: true })
    .eq("nonce_hash", toPostgresBytea(nonceHash));
  if (error) throw error;
  return (count ?? 0) > 0;
};

export const createDegreePlanDelegation = async (input: {
  readonly expiresAt: string;
  readonly idempotencyKey: string;
  readonly studentId: string;
  readonly tokenHash: Bytes32;
}) => {
  const { data, error } = await client().rpc(
    "create_degree_plan_delegation",
    {
      p_expires_at: input.expiresAt,
      p_idempotency_key: input.idempotencyKey,
      p_student_id: input.studentId,
      p_token_hash: toPostgresBytea(input.tokenHash),
    },
  );
  if (error) throw error;
  return delegationSchema.parse(data);
};

export const authorizeAgentDelegation = async (input: {
  readonly agentAddressCommitment: Bytes32;
  readonly endpoint: AgentKitEndpoint;
  readonly humanIdCommitment: Bytes32;
  readonly nonceExpiresAt: string;
  readonly nonceHash: Bytes32;
  readonly scope: AgentKitScope;
  readonly tokenHash: Bytes32;
}) => {
  const { data, error } = await client().rpc(
    "authorize_agent_delegation_scope",
    {
      p_agent_address_commitment: toPostgresBytea(
        input.agentAddressCommitment,
      ),
      p_endpoint: input.endpoint,
      p_human_id_commitment: toPostgresBytea(input.humanIdCommitment),
      p_nonce_expires_at: input.nonceExpiresAt,
      p_nonce_hash: toPostgresBytea(input.nonceHash),
      p_scope: input.scope,
      p_token_hash: toPostgresBytea(input.tokenHash),
    },
  );
  if (error) throw error;
  return authorizationSchema.parse(data);
};

export type AgentAuthorization = z.infer<typeof authorizationSchema> & {
  readonly humanIdCommitment: Bytes32;
};

export const getAgentDegreePlanContext = async (
  authorization: AgentAuthorization,
) => {
  const { data, error } = await client().rpc("get_agent_degree_plan_context", {
    p_delegation_id: authorization.delegationId,
    p_human_id_commitment: toPostgresBytea(
      authorization.humanIdCommitment,
    ),
    p_student_id: authorization.studentId,
  });
  if (error) throw error;
  return degreePlanContextSchema.parse(data);
};

export const submitAgentDegreePlanProposal = async (
  authorization: AgentAuthorization,
  input: {
    readonly courseCodes: string[];
    readonly summary: string;
  },
) => {
  const { data, error } = await client().rpc("submit_degree_plan_proposal", {
    p_course_codes: input.courseCodes,
    p_delegation_id: authorization.delegationId,
    p_human_id_commitment: toPostgresBytea(
      authorization.humanIdCommitment,
    ),
    p_student_id: authorization.studentId,
    p_summary: input.summary,
  });
  if (error) throw error;
  return proposalSchema.parse(data);
};
