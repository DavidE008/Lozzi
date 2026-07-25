"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth";
import { logEvent } from "@/lib/logging";
import { assertSameOrigin } from "@/lib/security/origin";
import { createClient } from "@/lib/supabase/server";

const gradeDraftSchema = z.object({
  sectionId: z.uuid(),
  grades: z
    .array(
      z.object({
        enrollmentId: z.uuid(),
        participationScore: z.number().min(0).max(10).nullable(),
        assignmentAverage: z.number().min(0).max(100).nullable(),
        finalExamScore: z.number().min(0).max(100).nullable(),
      }),
    )
    .min(1)
    .max(100),
  idempotencyKey: z.uuid(),
});

const sectionSubmissionSchema = z.object({
  sectionId: z.uuid(),
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

export interface GradeActionResult {
  readonly success: boolean;
  readonly message: string;
  readonly state?: string;
}

interface GradeMutationClient {
  rpc(
    functionName:
      "save_grade_drafts" | "submit_section_grades" | "start_grade_correction",
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
  return (await createClient()) as unknown as GradeMutationClient;
};

const revalidateGradeWorkflow = (sectionId?: string) => {
  revalidatePath("/instructor");
  revalidatePath("/instructor/gradebook");
  if (sectionId) {
    revalidatePath(`/instructor/sections/${sectionId}/grades`);
  }
  revalidatePath("/registrar/records");
};

const rejectedResult = (message: string): GradeActionResult => ({
  success: false,
  message,
});

export const saveGradeDrafts = async (
  input: z.input<typeof gradeDraftSchema>,
): Promise<GradeActionResult> => {
  try {
    const value = gradeDraftSchema.parse(input);
    const client = await mutationClient();
    const { data, error } = await client.rpc("save_grade_drafts", {
      p_section_id: value.sectionId,
      p_grades: value.grades.map((grade) => ({
        enrollmentId: grade.enrollmentId,
        participationScore: grade.participationScore,
        assignmentAverage: grade.assignmentAverage,
        finalExamScore: grade.finalExamScore,
      })),
      p_idempotency_key: value.idempotencyKey,
    });

    if (error) {
      logEvent("warn", "grade_draft_save_failed", {
        category: error.code ?? "unknown",
      });
      return rejectedResult(
        "Draft grades could not be saved. Please try again.",
      );
    }

    const result = actionResultSchema.parse(data);
    revalidateGradeWorkflow(value.sectionId);
    return result;
  } catch (error) {
    logEvent("warn", "grade_draft_save_rejected", {
      category:
        error instanceof z.ZodError ? "invalid_input" : "request_rejected",
    });
    return rejectedResult("Review the grade values and try again.");
  }
};

export const submitSectionGrades = async (
  input: z.input<typeof sectionSubmissionSchema>,
): Promise<GradeActionResult> => {
  try {
    const value = sectionSubmissionSchema.parse(input);
    const client = await mutationClient();
    const { data, error } = await client.rpc("submit_section_grades", {
      p_section_id: value.sectionId,
      p_idempotency_key: value.idempotencyKey,
    });

    if (error) {
      logEvent("warn", "grade_section_submit_failed", {
        category: error.code ?? "unknown",
      });
      return rejectedResult(
        "Grades could not be submitted. Complete every required field first.",
      );
    }

    const result = actionResultSchema.parse(data);
    revalidateGradeWorkflow(value.sectionId);
    return result;
  } catch (error) {
    logEvent("warn", "grade_section_submit_rejected", {
      category:
        error instanceof z.ZodError ? "invalid_input" : "request_rejected",
    });
    return rejectedResult("The grade submission request was rejected.");
  }
};

export const startGradeCorrection = async (
  input: z.input<typeof correctionSchema>,
): Promise<GradeActionResult> => {
  try {
    const value = correctionSchema.parse(input);
    const client = await mutationClient();
    const { data, error } = await client.rpc("start_grade_correction", {
      p_grade_record_id: value.gradeRecordId,
      p_reason_code: value.reasonCode,
      p_idempotency_key: value.idempotencyKey,
    });

    if (error) {
      logEvent("warn", "grade_correction_start_failed", {
        category: error.code ?? "unknown",
      });
      return rejectedResult("The grade correction could not be started.");
    }

    const result = actionResultSchema.parse(data);
    revalidateGradeWorkflow();
    return result;
  } catch (error) {
    logEvent("warn", "grade_correction_start_rejected", {
      category:
        error instanceof z.ZodError ? "invalid_input" : "request_rejected",
    });
    return rejectedResult("The correction request was rejected.");
  }
};
