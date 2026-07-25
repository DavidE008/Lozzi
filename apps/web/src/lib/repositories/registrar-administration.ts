import { cache } from "react";

import { logEvent } from "@/lib/logging";
import { createClient } from "@/lib/supabase/server";

const fail = (event: string, category: string, message: string): never => {
  logEvent("error", event, { category });
  throw new Error(message);
};

export interface RegistrarCatalog {
  readonly departments: readonly {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly status: string;
    readonly parentDepartmentId: string | null;
  }[];
  readonly courses: readonly {
    readonly id: string;
    readonly departmentId: string;
    readonly departmentCode: string;
    readonly code: string;
    readonly title: string;
    readonly description: string | null;
    readonly creditHours: number;
    readonly status: string;
  }[];
  readonly programs: readonly {
    readonly id: string;
    readonly departmentId: string;
    readonly code: string;
    readonly name: string;
    readonly credentialType: string;
    readonly status: string;
  }[];
  readonly programVersions: readonly {
    readonly id: string;
    readonly programId: string;
    readonly programName: string;
    readonly versionNumber: number;
    readonly effectiveTermId: string;
    readonly requiredCredits: number;
    readonly status: string;
  }[];
  readonly requirements: readonly {
    readonly id: string;
    readonly programVersionId: string;
    readonly courseId: string | null;
    readonly courseCode: string | null;
    readonly requirementGroup: string;
    readonly minimumCredits: number;
    readonly sortOrder: number;
  }[];
  readonly prerequisites: readonly {
    readonly id: string;
    readonly courseId: string;
    readonly courseCode: string;
    readonly prerequisiteCourseId: string;
    readonly prerequisiteCourseCode: string;
    readonly minimumGradePoints: number;
    readonly kind: string;
  }[];
}

export interface RegistrarTerm {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly registrationOpensAt: string | null;
  readonly registrationClosesAt: string | null;
  readonly addDropDeadline: string | null;
  readonly withdrawalDeadline: string | null;
  readonly gradesDueAt: string | null;
  readonly status: string;
  readonly maxCredits: number;
  readonly minCredits: number;
  readonly deactivatedAt: string | null;
}

export interface RegistrarStaffMember {
  readonly assignmentId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly role: string;
  readonly status: string;
}

export interface RegistrarMembership {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly initials: string;
  readonly role: string;
  readonly status: string;
  readonly deactivatedAt: string | null;
}

export interface RegistrarSectionInstructor {
  readonly id: string;
  readonly sectionId: string;
  readonly staffRoleAssignmentId: string;
  readonly displayName: string;
  readonly isPrimary: boolean;
}

export interface RegistrarSectionMeeting {
  readonly id: string;
  readonly sectionId: string;
  readonly weekday: number;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly location: string | null;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
}

export const getRegistrarCatalog = cache(
  async (institutionId: string): Promise<RegistrarCatalog> => {
    const supabase = await createClient();
    const [
      departmentResult,
      courseResult,
      programResult,
      versionResult,
      requirementResult,
      prerequisiteResult,
    ] = await Promise.all([
      supabase
        .from("departments")
        .select("id, code, name, status, parent_department_id")
        .eq("institution_id", institutionId)
        .is("deactivated_at", null)
        .order("code"),
      supabase
        .from("courses")
        .select(
          "id, department_id, code, title, description, credit_hours, status",
        )
        .eq("institution_id", institutionId)
        .is("deactivated_at", null)
        .order("code"),
      supabase
        .from("programs")
        .select("id, department_id, code, name, credential_type, status")
        .eq("institution_id", institutionId)
        .is("deactivated_at", null)
        .order("code"),
      supabase
        .from("program_versions")
        .select(
          "id, program_id, version_number, effective_term_id, required_credits, status",
        )
        .eq("institution_id", institutionId)
        .order("version_number", { ascending: false }),
      supabase
        .from("program_requirements")
        .select(
          "id, program_version_id, course_id, requirement_group, minimum_credits, sort_order",
        )
        .eq("institution_id", institutionId)
        .is("deactivated_at", null)
        .order("sort_order"),
      supabase
        .from("course_prerequisites")
        .select(
          "id, course_id, prerequisite_course_id, minimum_grade_points, kind",
        )
        .eq("institution_id", institutionId)
        .is("deactivated_at", null)
        .order("course_id"),
    ]);

    const firstError = [
      departmentResult.error,
      courseResult.error,
      programResult.error,
      versionResult.error,
      requirementResult.error,
      prerequisiteResult.error,
    ].find(Boolean);
    if (firstError) {
      fail(
        "registrar_catalog_failed",
        firstError.code,
        "The academic catalog could not be loaded.",
      );
    }

    const departmentNames = new Map(
      (departmentResult.data ?? []).map((row) => [row.id, row.code]),
    );
    const courseNames = new Map(
      (courseResult.data ?? []).map((row) => [row.id, row.code]),
    );
    const programNames = new Map(
      (programResult.data ?? []).map((row) => [row.id, row.name]),
    );

    return {
      departments: (departmentResult.data ?? []).map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        status: row.status,
        parentDepartmentId: row.parent_department_id,
      })),
      courses: (courseResult.data ?? []).map((row) => ({
        id: row.id,
        departmentId: row.department_id,
        departmentCode: departmentNames.get(row.department_id) ?? "—",
        code: row.code,
        title: row.title,
        description: row.description,
        creditHours: row.credit_hours,
        status: row.status,
      })),
      programs: (programResult.data ?? []).map((row) => ({
        id: row.id,
        departmentId: row.department_id,
        code: row.code,
        name: row.name,
        credentialType: row.credential_type,
        status: row.status,
      })),
      programVersions: (versionResult.data ?? []).map((row) => ({
        id: row.id,
        programId: row.program_id,
        programName: programNames.get(row.program_id) ?? "Programme",
        versionNumber: row.version_number,
        effectiveTermId: row.effective_term_id,
        requiredCredits: row.required_credits,
        status: row.status,
      })),
      requirements: (requirementResult.data ?? []).map((row) => ({
        id: row.id,
        programVersionId: row.program_version_id,
        courseId: row.course_id,
        courseCode: row.course_id
          ? (courseNames.get(row.course_id) ?? "Course")
          : null,
        requirementGroup: row.requirement_group,
        minimumCredits: row.minimum_credits,
        sortOrder: row.sort_order,
      })),
      prerequisites: (prerequisiteResult.data ?? []).map((row) => ({
        id: row.id,
        courseId: row.course_id,
        courseCode: courseNames.get(row.course_id) ?? "Course",
        prerequisiteCourseId: row.prerequisite_course_id,
        prerequisiteCourseCode:
          courseNames.get(row.prerequisite_course_id) ?? "Course",
        minimumGradePoints: row.minimum_grade_points,
        kind: row.kind,
      })),
    };
  },
);

export const getRegistrarTerms = cache(
  async (institutionId: string): Promise<readonly RegistrarTerm[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academic_terms")
      .select("*")
      .eq("institution_id", institutionId)
      .order("starts_on", { ascending: false });

    if (error) {
      fail(
        "registrar_terms_failed",
        error.code,
        "Academic terms could not be loaded.",
      );
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      registrationOpensAt: row.registration_opens_at,
      registrationClosesAt: row.registration_closes_at,
      addDropDeadline: row.add_drop_deadline,
      withdrawalDeadline: row.withdrawal_deadline,
      gradesDueAt: row.grades_due_at,
      status: row.status,
      maxCredits: row.max_credits,
      minCredits: row.min_credits,
      deactivatedAt: row.deactivated_at,
    }));
  },
);

export const getRegistrarStaff = cache(
  async (institutionId: string): Promise<readonly RegistrarStaffMember[]> => {
    const supabase = await createClient();
    const assignmentResult = await supabase
      .from("staff_role_assignments")
      .select("id, user_id, role, status")
      .eq("institution_id", institutionId)
      .is("deactivated_at", null)
      .order("role");

    if (assignmentResult.error) {
      fail(
        "registrar_staff_failed",
        assignmentResult.error.code,
        "Staff assignments could not be loaded.",
      );
    }

    const userIds = (assignmentResult.data ?? []).map((row) => row.user_id);
    const profileResult = userIds.length
      ? await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds)
      : { data: [], error: null };

    if (profileResult.error) {
      fail(
        "registrar_staff_profiles_failed",
        profileResult.error.code,
        "Staff profiles could not be loaded.",
      );
    }

    const names = new Map(
      (profileResult.data ?? []).map((row) => [row.id, row.display_name]),
    );
    return (assignmentResult.data ?? []).map((row) => ({
      assignmentId: row.id,
      userId: row.user_id,
      displayName: names.get(row.user_id) ?? "Staff member",
      role: row.role,
      status: row.status,
    }));
  },
);

export const getRegistrarMemberships = cache(
  async (institutionId: string): Promise<readonly RegistrarMembership[]> => {
    const supabase = await createClient();
    const membershipResult = await supabase
      .from("institution_memberships")
      .select("id, user_id, role, status, deactivated_at")
      .eq("institution_id", institutionId)
      .order("role");

    if (membershipResult.error) {
      fail(
        "registrar_memberships_failed",
        membershipResult.error.code,
        "Institution memberships could not be loaded.",
      );
    }

    const userIds = (membershipResult.data ?? []).map((row) => row.user_id);
    const profileResult = userIds.length
      ? await supabase
          .from("profiles")
          .select("id, display_name, initials")
          .in("id", userIds)
      : { data: [], error: null };

    if (profileResult.error) {
      fail(
        "registrar_membership_profiles_failed",
        profileResult.error.code,
        "Membership profiles could not be loaded.",
      );
    }

    const profiles = new Map(
      (profileResult.data ?? []).map((row) => [row.id, row]),
    );
    return (membershipResult.data ?? []).map((row) => {
      const profile = profiles.get(row.user_id);
      return {
        id: row.id,
        userId: row.user_id,
        displayName: profile?.display_name ?? "Institution member",
        initials: profile?.initials ?? "IM",
        role: row.role,
        status: row.status,
        deactivatedAt: row.deactivated_at,
      };
    });
  },
);

export const getRegistrarSectionResources = cache(
  async (
    institutionId: string,
  ): Promise<{
    readonly instructors: readonly RegistrarSectionInstructor[];
    readonly meetings: readonly RegistrarSectionMeeting[];
  }> => {
    const supabase = await createClient();
    const [instructorResult, meetingResult, staff] = await Promise.all([
      supabase
        .from("section_instructors")
        .select("id, section_id, staff_role_assignment_id, is_primary")
        .eq("institution_id", institutionId)
        .is("deactivated_at", null),
      supabase
        .from("section_meetings")
        .select(
          "id, section_id, weekday, starts_at, ends_at, location, starts_on, ends_on",
        )
        .eq("institution_id", institutionId)
        .is("deactivated_at", null)
        .order("weekday")
        .order("starts_at"),
      getRegistrarStaff(institutionId),
    ]);

    const firstError = instructorResult.error ?? meetingResult.error;
    if (firstError) {
      fail(
        "registrar_section_resources_failed",
        firstError.code,
        "Section resources could not be loaded.",
      );
    }

    const staffNames = new Map(
      staff.map((item) => [item.assignmentId, item.displayName]),
    );
    return {
      instructors: (instructorResult.data ?? []).map((row) => ({
        id: row.id,
        sectionId: row.section_id,
        staffRoleAssignmentId: row.staff_role_assignment_id,
        displayName:
          staffNames.get(row.staff_role_assignment_id) ?? "Staff member",
        isPrimary: row.is_primary,
      })),
      meetings: (meetingResult.data ?? []).map((row) => ({
        id: row.id,
        sectionId: row.section_id,
        weekday: row.weekday,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        location: row.location,
        startsOn: row.starts_on,
        endsOn: row.ends_on,
      })),
    };
  },
);
