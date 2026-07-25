"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  getRegistrarMutationContext,
  mutationError,
  type RegistrarActionResult,
} from "@/lib/registrar/mutation-context";

const optionalDateTime = z
  .string()
  .trim()
  .optional()
  .transform((value, context) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      context.addIssue({
        code: "custom",
        message: "Enter a valid date and time.",
      });
      return z.NEVER;
    }
    return parsed.toISOString();
  });

const termSchema = z
  .object({
    institutionId: z.uuid(),
    code: z
      .string()
      .trim()
      .min(2)
      .max(24)
      .regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/)
      .transform((value) => value.toUpperCase()),
    name: z.string().trim().min(2).max(120),
    startsOn: z.iso.date(),
    endsOn: z.iso.date(),
    registrationOpensAt: optionalDateTime,
    registrationClosesAt: optionalDateTime,
    addDropDeadline: optionalDateTime,
    withdrawalDeadline: optionalDateTime,
    gradesDueAt: optionalDateTime,
    status: z.enum(["planned", "registration_open", "in_progress", "closed"]),
    maxCredits: z.coerce.number().positive().max(99),
    minCredits: z.coerce.number().min(0).max(99),
  })
  .refine((value) => value.endsOn > value.startsOn, {
    message: "The term must end after it starts.",
    path: ["endsOn"],
  })
  .refine((value) => value.maxCredits >= value.minCredits, {
    message: "Maximum credits must be at least the minimum.",
    path: ["maxCredits"],
  });

const termStatusSchema = z.object({
  institutionId: z.uuid(),
  id: z.uuid(),
  status: z.enum(["planned", "registration_open", "in_progress", "closed"]),
});

const termIdentitySchema = z.object({
  institutionId: z.uuid(),
  id: z.uuid(),
});

const revalidateTerms = (message: string): RegistrarActionResult => {
  revalidatePath("/registrar");
  revalidatePath("/registrar/terms");
  revalidatePath("/registrar/audit");
  return { success: message };
};

export const createTerm = async (
  input: z.input<typeof termSchema>,
): Promise<RegistrarActionResult> => {
  try {
    const value = termSchema.parse(input);
    const { supabase } = await getRegistrarMutationContext(value.institutionId);
    const { error } = await supabase.from("academic_terms").insert({
      institution_id: value.institutionId,
      code: value.code,
      name: value.name,
      starts_on: value.startsOn,
      ends_on: value.endsOn,
      registration_opens_at: value.registrationOpensAt,
      registration_closes_at: value.registrationClosesAt,
      add_drop_deadline: value.addDropDeadline,
      withdrawal_deadline: value.withdrawalDeadline,
      grades_due_at: value.gradesDueAt,
      status: value.status,
      max_credits: value.maxCredits,
      min_credits: value.minCredits,
    });

    if (error) return mutationError("term_create_failed", error);
    return revalidateTerms("Academic term created.");
  } catch (error) {
    return mutationError("term_create_rejected", error);
  }
};

export const updateTermStatus = async (
  input: z.input<typeof termStatusSchema>,
): Promise<RegistrarActionResult> => {
  try {
    const value = termStatusSchema.parse(input);
    const { supabase } = await getRegistrarMutationContext(value.institutionId);
    const { error } = await supabase
      .from("academic_terms")
      .update({ status: value.status })
      .eq("id", value.id)
      .eq("institution_id", value.institutionId);

    if (error) return mutationError("term_status_failed", error);
    return revalidateTerms("Academic term status updated.");
  } catch (error) {
    return mutationError("term_status_rejected", error);
  }
};

export const deactivateTerm = async (
  input: z.input<typeof termIdentitySchema>,
): Promise<RegistrarActionResult> => {
  try {
    const value = termIdentitySchema.parse(input);
    const { supabase } = await getRegistrarMutationContext(value.institutionId);
    const { error } = await supabase
      .from("academic_terms")
      .update({ deactivated_at: new Date().toISOString() })
      .eq("id", value.id)
      .eq("institution_id", value.institutionId);

    if (error) return mutationError("term_deactivate_failed", error);
    return revalidateTerms("Academic term deactivated.");
  } catch (error) {
    return mutationError("term_deactivate_rejected", error);
  }
};
