"use server";

import { createCommitment, type GradeCorrectionReason } from "@lozzi/domain";
import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth";
import { logEvent } from "@/lib/logging";
import { getRecordCommitmentPreview } from "@/lib/repositories/grades";
import { assertSameOrigin } from "@/lib/security/origin";
import { createClient } from "@/lib/supabase/server";

const approvalSchema = z.object({
  gradeSubmissionId: z.uuid(),
  idempotencyKey: z.uuid(),
});

const correctionSchema = z.object({
  gradeRecordId: z.uuid(),
  reasonCode: z.enum([
    "clerical_error",
    "calculation_error",
    "incomplete_resolved",
    "appeal_outcome",
    "other_documented",
  ]),
  idempotencyKey: z.uuid(),
});

const actionResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  state: z.string().optional(),
});

export interface RegistrarGradeActionResult {
  readonly success: boolean;
  readonly message: string;
  readonly state?: string;
}

interface RegistrarGradeMutationClient {
  rpc(
    functionName:
      | "approve_grade_submission"
      | "publish_grade_submission"
      | "start_grade_correction",
    parameters: Readonly<Record<string, unknown>>,
  ): Promise<{
    readonly data: unknown;
    readonly error: { readonly code?: string } | null;
  }>;
}

const mutationClient = async () => {
  await assertSameOrigin();
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Authentication required.");
  return (await createClient()) as unknown as RegistrarGradeMutationClient;
};

const revalidateRecordWorkflow = () => {
  revalidatePath("/registrar");
  revalidatePath("/registrar/records");
  revalidatePath("/instructor");
  revalidatePath("/student");
  revalidatePath("/student/record");
  revalidatePath("/student/progress");
};

const rejected = (message: string): RegistrarGradeActionResult => ({
  success: false,
  message,
});

export const approveGradeSubmission = async (
  input: z.input<typeof approvalSchema>,
): Promise<RegistrarGradeActionResult> => {
  try {
    const value = approvalSchema.parse(input);
    const client = await mutationClient();
    const { data, error } = await client.rpc("approve_grade_submission", {
      p_grade_submission_id: value.gradeSubmissionId,
      p_idempotency_key: value.idempotencyKey,
    });

    if (error) {
      logEvent("warn", "grade_approval_failed", {
        category: error.code ?? "unknown",
      });
      return rejected("The grade could not be approved.");
    }

    const result = actionResultSchema.parse(data);
    revalidateRecordWorkflow();
    return result;
  } catch (error) {
    logEvent("warn", "grade_approval_rejected", {
      category:
        error instanceof z.ZodError ? "invalid_input" : "request_rejected",
    });
    return rejected("The approval request was rejected.");
  }
};

export const publishGradeSubmission = async (
  input: z.input<typeof approvalSchema>,
): Promise<RegistrarGradeActionResult> => {
  try {
    const value = approvalSchema.parse(input);
    await assertSameOrigin();
    const user = await getAuthenticatedUser();
    if (!user) throw new Error("Authentication required.");

    const preview = await getRecordCommitmentPreview(value.gradeSubmissionId);
    if (!preview) return rejected("The approved grade is no longer available.");

    const salt = `0x${randomBytes(32).toString("hex")}` as const;
    const commitment = createCommitment({
      domain: "academic-record",
      institutionId: preview.institutionId,
      salt,
      payload: preview.payload,
    });
    const saltReference = `private-synthetic:${salt}`;
    const client =
      (await createClient()) as unknown as RegistrarGradeMutationClient;
    const { data, error } = await client.rpc("publish_grade_submission", {
      p_grade_submission_id: value.gradeSubmissionId,
      p_content_commitment: `\\x${commitment.slice(2)}`,
      p_salt_reference: saltReference,
      p_idempotency_key: value.idempotencyKey,
    });

    if (error) {
      logEvent("warn", "grade_publication_failed", {
        category: error.code ?? "unknown",
      });
      return rejected("The approved grade could not be published.");
    }

    const result = actionResultSchema.parse(data);
    revalidateRecordWorkflow();
    return result;
  } catch (error) {
    logEvent("warn", "grade_publication_rejected", {
      category:
        error instanceof z.ZodError ? "invalid_input" : "request_rejected",
    });
    return rejected("The publication request was rejected.");
  }
};

export const startRegistrarGradeCorrection = async (input: {
  readonly gradeRecordId: string;
  readonly reasonCode: GradeCorrectionReason;
  readonly idempotencyKey?: string;
}): Promise<RegistrarGradeActionResult> => {
  try {
    const value = correctionSchema.parse({
      ...input,
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
    });
    const client = await mutationClient();
    const { data, error } = await client.rpc("start_grade_correction", {
      p_grade_record_id: value.gradeRecordId,
      p_reason_code: value.reasonCode,
      p_idempotency_key: value.idempotencyKey,
    });

    if (error) {
      logEvent("warn", "registrar_grade_correction_failed", {
        category: error.code ?? "unknown",
      });
      return rejected("The correction draft could not be started.");
    }

    const result = actionResultSchema.parse(data);
    revalidateRecordWorkflow();
    return result;
  } catch (error) {
    logEvent("warn", "registrar_grade_correction_rejected", {
      category:
        error instanceof z.ZodError ? "invalid_input" : "request_rejected",
    });
    return rejected("The correction request was rejected.");
  }
};
