"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  getRegistrarMutationContext,
  mutationError,
  type RegistrarActionResult,
} from "@/lib/registrar/mutation-context";

const institutionSchema = z.object({
  institutionId: z.uuid(),
  name: z.string().trim().min(2).max(160),
});

const membershipSchema = z.object({
  institutionId: z.uuid(),
  id: z.uuid(),
  status: z.enum(["active", "inactive"]),
});

const staffRoleSchema = z.object({
  institutionId: z.uuid(),
  userId: z.uuid(),
  role: z.enum(["registrar", "instructor", "advisor", "institution_admin"]),
  validUntil: z
    .union([z.iso.datetime({ local: true }), z.literal("")])
    .optional(),
});

const roleIdentitySchema = z.object({
  institutionId: z.uuid(),
  id: z.uuid(),
});

const requireInstitutionAdmin = async (institutionId: string) => {
  const context = await getRegistrarMutationContext(institutionId);
  if (!context.access.roles.includes("institution_admin")) {
    throw Object.assign(new Error("Institution administrator required."), {
      code: "42501",
    });
  }
  return context;
};

const revalidateSettings = (message: string): RegistrarActionResult => {
  revalidatePath("/");
  revalidatePath("/registrar");
  revalidatePath("/registrar/settings");
  revalidatePath("/registrar/audit");
  return { success: message };
};

export const updateInstitutionName = async (
  input: z.input<typeof institutionSchema>,
): Promise<RegistrarActionResult> => {
  try {
    const value = institutionSchema.parse(input);
    const { supabase } = await requireInstitutionAdmin(value.institutionId);
    const { error } = await supabase
      .from("institutions")
      .update({ name: value.name })
      .eq("id", value.institutionId);

    if (error) return mutationError("institution_update_failed", error);
    return revalidateSettings("Institution name updated.");
  } catch (error) {
    return mutationError("institution_update_rejected", error);
  }
};

export const setMembershipStatus = async (
  input: z.input<typeof membershipSchema>,
): Promise<RegistrarActionResult> => {
  try {
    const value = membershipSchema.parse(input);
    const { supabase } = await requireInstitutionAdmin(value.institutionId);
    const { error } = await supabase
      .from("institution_memberships")
      .update({
        status: value.status,
        deactivated_at:
          value.status === "inactive" ? new Date().toISOString() : null,
      })
      .eq("id", value.id)
      .eq("institution_id", value.institutionId);

    if (error) return mutationError("membership_status_failed", error);
    return revalidateSettings(`Membership ${value.status}.`);
  } catch (error) {
    return mutationError("membership_status_rejected", error);
  }
};

export const assignStaffRole = async (
  input: z.input<typeof staffRoleSchema>,
): Promise<RegistrarActionResult> => {
  try {
    const value = staffRoleSchema.parse(input);
    const { supabase } = await requireInstitutionAdmin(value.institutionId);
    const { error } = await supabase.from("staff_role_assignments").insert({
      institution_id: value.institutionId,
      user_id: value.userId,
      role: value.role,
      status: "active",
      valid_from: new Date().toISOString(),
      valid_until: value.validUntil
        ? new Date(value.validUntil).toISOString()
        : null,
    });

    if (error) return mutationError("staff_role_assign_failed", error);
    return revalidateSettings("Staff role assigned.");
  } catch (error) {
    return mutationError("staff_role_assign_rejected", error);
  }
};

export const deactivateStaffRole = async (
  input: z.input<typeof roleIdentitySchema>,
): Promise<RegistrarActionResult> => {
  try {
    const value = roleIdentitySchema.parse(input);
    const { supabase } = await requireInstitutionAdmin(value.institutionId);
    const { error } = await supabase
      .from("staff_role_assignments")
      .update({ status: "inactive", deactivated_at: new Date().toISOString() })
      .eq("id", value.id)
      .eq("institution_id", value.institutionId);

    if (error) return mutationError("staff_role_deactivate_failed", error);
    return revalidateSettings("Staff role deactivated.");
  } catch (error) {
    return mutationError("staff_role_deactivate_rejected", error);
  }
};
