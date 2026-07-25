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
const code = z
  .string()
  .trim()
  .min(2)
  .max(24)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/)
  .transform((value) => value.toUpperCase());
const label = z.string().trim().min(2).max(160);

const departmentSchema = baseSchema.extend({
  code,
  name: label,
  parentDepartmentId: z.uuid().optional(),
});

const courseSchema = baseSchema.extend({
  departmentId: z.uuid(),
  code,
  title: label,
  description: z.string().trim().max(1200).optional(),
  creditHours: z.coerce.number().positive().max(30),
});

const programSchema = baseSchema.extend({
  departmentId: z.uuid(),
  code,
  name: label,
  credentialType: z.string().trim().min(2).max(80),
});

const programVersionSchema = baseSchema.extend({
  programId: z.uuid(),
  effectiveTermId: z.uuid(),
  versionNumber: z.coerce.number().int().positive().max(999),
  requiredCredits: z.coerce.number().positive().max(999),
});

const requirementSchema = baseSchema.extend({
  programVersionId: z.uuid(),
  courseId: z.uuid().optional(),
  requirementGroup: z.string().trim().min(2).max(100),
  minimumCredits: z.coerce.number().min(0).max(999),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

const prerequisiteSchema = baseSchema.extend({
  courseId: z.uuid(),
  prerequisiteCourseId: z.uuid(),
  minimumGradePoints: z.coerce.number().min(0).max(4),
  kind: z.enum(["prerequisite", "corequisite"]),
});

const deactivateSchema = baseSchema.extend({
  id: z.uuid(),
  resource: z.enum([
    "department",
    "course",
    "program",
    "requirement",
    "prerequisite",
  ]),
});

const saved = (message: string): RegistrarActionResult => {
  revalidatePath("/registrar");
  revalidatePath("/registrar/catalog");
  revalidatePath("/registrar/audit");
  return { success: message };
};

export const createDepartment = async (
  input: z.input<typeof departmentSchema>,
): Promise<RegistrarActionResult> => {
  try {
    const value = departmentSchema.parse(input);
    const { supabase } = await getRegistrarMutationContext(value.institutionId);
    const { error } = await supabase.from("departments").insert({
      institution_id: value.institutionId,
      parent_department_id: value.parentDepartmentId ?? null,
      code: value.code,
      name: value.name,
    });
    if (error) return mutationError("department_create_failed", error);
    return saved("Department created.");
  } catch (error) {
    return mutationError("department_create_rejected", error);
  }
};

export const createCourse = async (
  input: z.input<typeof courseSchema>,
): Promise<RegistrarActionResult> => {
  try {
    const value = courseSchema.parse(input);
    const { supabase } = await getRegistrarMutationContext(value.institutionId);
    const { error } = await supabase.from("courses").insert({
      institution_id: value.institutionId,
      department_id: value.departmentId,
      code: value.code,
      title: value.title,
      description: value.description || null,
      credit_hours: value.creditHours,
    });
    if (error) return mutationError("course_create_failed", error);
    return saved("Course created.");
  } catch (error) {
    return mutationError("course_create_rejected", error);
  }
};

export const createProgram = async (
  input: z.input<typeof programSchema>,
): Promise<RegistrarActionResult> => {
  try {
    const value = programSchema.parse(input);
    const { supabase } = await getRegistrarMutationContext(value.institutionId);
    const { error } = await supabase.from("programs").insert({
      institution_id: value.institutionId,
      department_id: value.departmentId,
      code: value.code,
      name: value.name,
      credential_type: value.credentialType,
    });
    if (error) return mutationError("program_create_failed", error);
    return saved("Programme created.");
  } catch (error) {
    return mutationError("program_create_rejected", error);
  }
};

export const createProgramVersion = async (
  input: z.input<typeof programVersionSchema>,
): Promise<RegistrarActionResult> => {
  try {
    const value = programVersionSchema.parse(input);
    const { supabase } = await getRegistrarMutationContext(value.institutionId);
    const { error } = await supabase.from("program_versions").insert({
      institution_id: value.institutionId,
      program_id: value.programId,
      version_number: value.versionNumber,
      effective_term_id: value.effectiveTermId,
      required_credits: value.requiredCredits,
      status: "draft",
    });
    if (error) return mutationError("program_version_create_failed", error);
    return saved("Draft programme version created.");
  } catch (error) {
    return mutationError("program_version_create_rejected", error);
  }
};

export const createRequirement = async (
  input: z.input<typeof requirementSchema>,
): Promise<RegistrarActionResult> => {
  try {
    const value = requirementSchema.parse(input);
    const { supabase } = await getRegistrarMutationContext(value.institutionId);
    const { error } = await supabase.from("program_requirements").insert({
      institution_id: value.institutionId,
      program_version_id: value.programVersionId,
      course_id: value.courseId ?? null,
      requirement_group: value.requirementGroup,
      minimum_credits: value.minimumCredits,
      sort_order: value.sortOrder,
      rule_config: {},
    });
    if (error) return mutationError("requirement_create_failed", error);
    return saved("Programme requirement created.");
  } catch (error) {
    return mutationError("requirement_create_rejected", error);
  }
};

export const createPrerequisite = async (
  input: z.input<typeof prerequisiteSchema>,
): Promise<RegistrarActionResult> => {
  try {
    const value = prerequisiteSchema.parse(input);
    if (value.courseId === value.prerequisiteCourseId) {
      return { error: "A course cannot require itself." };
    }
    const { supabase } = await getRegistrarMutationContext(value.institutionId);
    const { error } = await supabase.from("course_prerequisites").insert({
      institution_id: value.institutionId,
      course_id: value.courseId,
      prerequisite_course_id: value.prerequisiteCourseId,
      minimum_grade_points: value.minimumGradePoints,
      kind: value.kind,
    });
    if (error) return mutationError("prerequisite_create_failed", error);
    return saved("Course prerequisite created.");
  } catch (error) {
    return mutationError("prerequisite_create_rejected", error);
  }
};

export const deactivateCatalogResource = async (
  input: z.input<typeof deactivateSchema>,
): Promise<RegistrarActionResult> => {
  try {
    const value = deactivateSchema.parse(input);
    const { supabase } = await getRegistrarMutationContext(value.institutionId);
    const deactivatedAt = new Date().toISOString();
    const result =
      value.resource === "department"
        ? await supabase
            .from("departments")
            .update({ status: "inactive", deactivated_at: deactivatedAt })
            .eq("id", value.id)
            .eq("institution_id", value.institutionId)
        : value.resource === "course"
          ? await supabase
              .from("courses")
              .update({ status: "inactive", deactivated_at: deactivatedAt })
              .eq("id", value.id)
              .eq("institution_id", value.institutionId)
          : value.resource === "program"
            ? await supabase
                .from("programs")
                .update({ status: "inactive", deactivated_at: deactivatedAt })
                .eq("id", value.id)
                .eq("institution_id", value.institutionId)
            : value.resource === "requirement"
              ? await supabase
                  .from("program_requirements")
                  .update({ deactivated_at: deactivatedAt })
                  .eq("id", value.id)
                  .eq("institution_id", value.institutionId)
              : await supabase
                  .from("course_prerequisites")
                  .update({ deactivated_at: deactivatedAt })
                  .eq("id", value.id)
                  .eq("institution_id", value.institutionId);

    if (result.error) {
      return mutationError("catalog_resource_deactivate_failed", result.error);
    }
    return saved("Academic resource deactivated.");
  } catch (error) {
    return mutationError("catalog_resource_deactivate_rejected", error);
  }
};
