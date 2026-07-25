"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth";
import { reviewAdvisorDegreePlanProposal } from "@/lib/repositories/advisor";

const reviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  proposalId: z.uuid(),
  reviewNote: z.string().trim().min(1).max(1_200),
});

export async function reviewDegreePlanProposal(
  formData: FormData,
): Promise<void> {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Authentication required.");
  const input = reviewSchema.parse({
    decision: formData.get("decision"),
    proposalId: formData.get("proposalId"),
    reviewNote: formData.get("reviewNote"),
  });
  await reviewAdvisorDegreePlanProposal(input);
  revalidatePath("/advisor");
}
