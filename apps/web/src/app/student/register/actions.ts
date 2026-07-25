"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth";
import { logEvent } from "@/lib/logging";
import { assertSameOrigin } from "@/lib/security/origin";
import { createClient } from "@/lib/supabase/server";

const registerSchema = z.object({
  sectionIds: z.array(z.uuid()).min(1).max(10),
  idempotencyKey: z.uuid(),
});

const withdrawSchema = z.object({
  enrollmentId: z.uuid(),
  idempotencyKey: z.uuid(),
});

const actionResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  code: z.string().optional(),
});

export interface RegistrationActionResult {
  readonly success: boolean;
  readonly message: string;
  readonly code?: string;
}

interface RegistrationMutationClient {
  rpc(
    functionName: "register_for_sections" | "withdraw_from_section",
    parameters: Readonly<Record<string, string | readonly string[]>>,
  ): Promise<{
    readonly data: unknown;
    readonly error: { readonly code?: string } | null;
  }>;
}

const mutationContext = async () => {
  await assertSameOrigin();
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Authentication required.");
  return (await createClient()) as unknown as RegistrationMutationClient;
};

const revalidateRegistration = () => {
  revalidatePath("/student");
  revalidatePath("/student/register");
  revalidatePath("/student/schedule");
};

export const submitRegistration = async (
  input: z.input<typeof registerSchema>,
): Promise<RegistrationActionResult> => {
  try {
    const value = registerSchema.parse(input);
    const supabase = await mutationContext();
    const { data, error } = await supabase.rpc("register_for_sections", {
      p_section_ids: value.sectionIds,
      p_idempotency_key: value.idempotencyKey,
    });
    if (error) {
      logEvent("warn", "registration_submit_failed", {
        category: error.code ?? "unknown",
      });
      return {
        success: false,
        message: "Registration could not be submitted. Please try again.",
      };
    }

    const result = actionResultSchema.parse(data);
    revalidateRegistration();
    return result;
  } catch (error) {
    logEvent("warn", "registration_submit_rejected", {
      category:
        error instanceof z.ZodError ? "invalid_input" : "request_rejected",
    });
    return {
      success: false,
      message:
        "Registration could not be submitted. Please review your selection.",
    };
  }
};

export const withdrawEnrollment = async (
  input: z.input<typeof withdrawSchema>,
): Promise<RegistrationActionResult> => {
  try {
    const value = withdrawSchema.parse(input);
    const supabase = await mutationContext();
    const { data, error } = await supabase.rpc("withdraw_from_section", {
      p_enrollment_id: value.enrollmentId,
      p_idempotency_key: value.idempotencyKey,
    });
    if (error) {
      logEvent("warn", "registration_withdraw_failed", {
        category: error.code ?? "unknown",
      });
      return {
        success: false,
        message: "The course could not be withdrawn. Please try again.",
      };
    }

    const result = actionResultSchema.parse(data);
    revalidateRegistration();
    return result;
  } catch (error) {
    logEvent("warn", "registration_withdraw_rejected", {
      category:
        error instanceof z.ZodError ? "invalid_input" : "request_rejected",
    });
    return {
      success: false,
      message: "The withdrawal request could not be completed.",
    };
  }
};
