"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  getRegistrarMutationContext,
  mutationError,
  type RegistrarActionResult,
} from "@/lib/registrar/mutation-context";

const baseSchema = z.object({
  institutionId: z.uuid(),
});
const location = z.string().trim().max(160).optional();

const sectionSchema = baseSchema.extend({
  courseId: z.uuid(),
  termId: z.uuid(),
  sectionCode: z
    .string()
    .trim()
    .min(1)
    .max(16)
    .transform((value) => value.toUpperCase()),
  capacity: z.coerce.number().int().positive().max(9999),
  location,
  deliveryMode: z.enum(["in_person", "online", "hybrid"]),
  status: z.enum(["planned", "open", "closed", "cancelled"]),
});

const updateSectionSchema = baseSchema.extend({
  id: z.uuid(),
  capacity: z.coerce.number().int().positive().max(9999),
  location,
  deliveryMode: z.enum(["in_person", "online", "hybrid"]),
  status: z.enum(["planned", "open", "closed", "cancelled"]),
});

const instructorSchema = baseSchema.extend({
  sectionId: z.uuid(),
  staffRoleAssignmentId: z.uuid(),
  isPrimary: z.boolean(),
});

const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const meetingSchema = baseSchema
  .extend({
    sectionId: z.uuid(),
    weekday: z.coerce.number().int().min(1).max(7),
    startsAt: time,
    endsAt: time,
    location,
    startsOn: z.union([z.iso.date(), z.literal("")]).optional(),
    endsOn: z.union([z.iso.date(), z.literal("")]).optional(),
  })
  .refine((value) => value.endsAt > value.startsAt, {
    message: "The meeting must end after it starts.",
    path: ["endsAt"],
  });

const deactivateSchema = baseSchema.extend({
  id: z.uuid(),
  resource: z.enum(["section", "instructor", "meeting"]),
});

const revalidateSections = (message: string): RegistrarActionResult => {
  revalidatePath("/registrar");
  revalidatePath("/registrar/sections");
  revalidatePath("/registrar/audit");
  return { success: message };
};

export const createSection = async (
  input: z.input<typeof sectionSchema>,
): Promise<RegistrarActionResult> => {
  try {
    const value = sectionSchema.parse(input);
    const { supabase } = await getRegistrarMutationContext(value.institutionId);
    const { error } = await supabase.from("course_sections").insert({
      institution_id: value.institutionId,
      course_id: value.courseId,
      term_id: value.termId,
      section_code: value.sectionCode,
      capacity: value.capacity,
      enrolled_count: 0,
      location: value.location || null,
      delivery_mode: value.deliveryMode,
      status: value.status,
    });

    if (error) return mutationError("section_create_failed", error);
    return revalidateSections("Course section created.");
  } catch (error) {
    return mutationError("section_create_rejected", error);
  }
};

export const updateSection = async (
  input: z.input<typeof updateSectionSchema>,
): Promise<RegistrarActionResult> => {
  try {
    const value = updateSectionSchema.parse(input);
    const { supabase } = await getRegistrarMutationContext(value.institutionId);
    const { error } = await supabase
      .from("course_sections")
      .update({
        capacity: value.capacity,
        location: value.location || null,
        delivery_mode: value.deliveryMode,
        status: value.status,
      })
      .eq("id", value.id)
      .eq("institution_id", value.institutionId);

    if (error) return mutationError("section_update_failed", error);
    return revalidateSections("Course section updated.");
  } catch (error) {
    return mutationError("section_update_rejected", error);
  }
};

export const assignSectionInstructor = async (
  input: z.input<typeof instructorSchema>,
): Promise<RegistrarActionResult> => {
  try {
    const value = instructorSchema.parse(input);
    const { supabase } = await getRegistrarMutationContext(value.institutionId);
    const { error } = await supabase.from("section_instructors").insert({
      institution_id: value.institutionId,
      section_id: value.sectionId,
      staff_role_assignment_id: value.staffRoleAssignmentId,
      is_primary: value.isPrimary,
    });

    if (error) return mutationError("section_instructor_failed", error);
    return revalidateSections("Instructor assigned.");
  } catch (error) {
    return mutationError("section_instructor_rejected", error);
  }
};

export const createSectionMeeting = async (
  input: z.input<typeof meetingSchema>,
): Promise<RegistrarActionResult> => {
  try {
    const value = meetingSchema.parse(input);
    const { supabase } = await getRegistrarMutationContext(value.institutionId);
    const { error } = await supabase.from("section_meetings").insert({
      institution_id: value.institutionId,
      section_id: value.sectionId,
      weekday: value.weekday,
      starts_at: value.startsAt,
      ends_at: value.endsAt,
      location: value.location || null,
      starts_on: value.startsOn || null,
      ends_on: value.endsOn || null,
    });

    if (error) return mutationError("section_meeting_failed", error);
    return revalidateSections("Section meeting created.");
  } catch (error) {
    return mutationError("section_meeting_rejected", error);
  }
};

export const deactivateSectionResource = async (
  input: z.input<typeof deactivateSchema>,
): Promise<RegistrarActionResult> => {
  try {
    const value = deactivateSchema.parse(input);
    const { supabase } = await getRegistrarMutationContext(value.institutionId);
    const deactivatedAt = new Date().toISOString();
    const result =
      value.resource === "section"
        ? await supabase
            .from("course_sections")
            .update({ status: "cancelled", deactivated_at: deactivatedAt })
            .eq("id", value.id)
            .eq("institution_id", value.institutionId)
        : value.resource === "instructor"
          ? await supabase
              .from("section_instructors")
              .update({ deactivated_at: deactivatedAt })
              .eq("id", value.id)
              .eq("institution_id", value.institutionId)
          : await supabase
              .from("section_meetings")
              .update({ deactivated_at: deactivatedAt })
              .eq("id", value.id)
              .eq("institution_id", value.institutionId);

    if (result.error) {
      return mutationError("section_resource_deactivate_failed", result.error);
    }
    return revalidateSections("Section resource deactivated.");
  } catch (error) {
    return mutationError("section_resource_deactivate_rejected", error);
  }
};
