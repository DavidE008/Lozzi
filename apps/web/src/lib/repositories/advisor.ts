import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

interface AdvisorRpcClient {
  rpc(
    name: "get_advisor_degree_plan_proposals",
  ): Promise<{
    readonly data: unknown;
    readonly error: { readonly code?: string; readonly message?: string } | null;
  }>;
  rpc(
    name: "review_degree_plan_proposal",
    params: {
      p_decision: "approved" | "rejected";
      p_proposal_id: string;
      p_review_note: string;
    },
  ): Promise<{
    readonly data: unknown;
    readonly error: { readonly code?: string; readonly message?: string } | null;
  }>;
}

const proposalSchema = z.object({
  items: z.array(
    z.object({
      courseCode: z.string().min(1).max(40),
      sortOrder: z.number().int().min(1).max(12),
    }),
  ),
  proposalId: z.uuid(),
  reviewNote: z.string().nullable(),
  reviewedAt: z.iso.datetime().nullable(),
  status: z.enum(["pending", "approved", "rejected", "withdrawn"]),
  studentDisplayName: z.string().min(1).max(160),
  studentNumber: z.string().min(1).max(80),
  submittedAt: z.iso.datetime(),
  summary: z.string().min(1).max(1_200),
});

const reviewResultSchema = z.object({
  proposalId: z.uuid(),
  reviewedAt: z.iso.datetime(),
  status: z.enum(["approved", "rejected"]),
});

const advisorClient = async () =>
  (await createClient()) as unknown as AdvisorRpcClient;

export type AdvisorDegreePlanProposal = z.infer<typeof proposalSchema>;

export const getAdvisorDegreePlanProposals = async () => {
  const { data, error } = await (await advisorClient()).rpc(
    "get_advisor_degree_plan_proposals",
  );
  if (error) throw new Error("The advisor review queue could not be loaded.");
  return z.array(proposalSchema).parse(data);
};

export const reviewAdvisorDegreePlanProposal = async (input: {
  readonly decision: "approved" | "rejected";
  readonly proposalId: string;
  readonly reviewNote: string;
}) => {
  const { data, error } = await (await advisorClient()).rpc(
    "review_degree_plan_proposal",
    {
      p_decision: input.decision,
      p_proposal_id: input.proposalId,
      p_review_note: input.reviewNote,
    },
  );
  if (error) throw new Error("The advisor decision could not be saved.");
  return reviewResultSchema.parse(data);
};
