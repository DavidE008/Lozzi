import type {
  RegistrarActivity,
  RegistrarAttentionItem,
  RegistrarSection,
  RegistrarStudent,
  RegistrarWorkspace,
  RegistrarWorkspaceRepository,
} from "@lozzi/domain";
import { cache } from "react";

import { logEvent } from "@/lib/logging";
import { createClient } from "@/lib/supabase/server";

const text = (value: string | null, fallback: string) => value ?? fallback;
const number = (value: number | null) => value ?? 0;

interface RegistrarWorkspaceSource {
  readonly summary: {
    readonly institution_id: string | null;
    readonly institution_name: string | null;
    readonly term_id: string | null;
    readonly term_name: string | null;
    readonly term_status: string | null;
    readonly starts_on: string | null;
    readonly ends_on: string | null;
    readonly registration_opens_at: string | null;
    readonly registration_closes_at: string | null;
    readonly add_drop_deadline: string | null;
    readonly withdrawal_deadline: string | null;
    readonly grades_due_at: string | null;
    readonly active_student_count: number | null;
    readonly course_section_count: number | null;
    readonly records_awaiting_publication: number | null;
  } | null;
  readonly attentionItems: readonly {
    readonly item_id: string | null;
    readonly student_id: string | null;
    readonly student_display_name: string | null;
    readonly record_type: string | null;
    readonly course_code: string | null;
    readonly course_title: string | null;
    readonly submitted_by_display_name: string | null;
    readonly submitted_at: string | null;
    readonly status: string | null;
    readonly version_number: number | null;
  }[];
  readonly activity: readonly {
    readonly activity_id: string | null;
    readonly occurred_at: string | null;
    readonly actor_display_name: string | null;
    readonly actor_role: string | null;
    readonly action: string | null;
    readonly entity_type: string | null;
    readonly entity_id: string | null;
    readonly outcome: string | null;
  }[];
}

const mapAttentionItem = (
  item: RegistrarWorkspaceSource["attentionItems"][number],
): RegistrarAttentionItem | null => {
  if (!item.item_id || !item.student_id) return null;
  return {
    id: item.item_id,
    studentId: item.student_id,
    studentDisplayName: text(item.student_display_name, "Student"),
    recordType: text(item.record_type, "Academic record"),
    courseCode: text(item.course_code, "Course"),
    courseTitle: text(item.course_title, "Untitled course"),
    submittedByDisplayName: text(item.submitted_by_display_name, "Staff"),
    submittedAt: item.submitted_at,
    status: item.status === "submitted" ? "submitted" : "approved",
    versionNumber: number(item.version_number),
  };
};

export const mapRegistrarActivity = (
  item: RegistrarWorkspaceSource["activity"][number],
): RegistrarActivity | null => {
  if (!item.activity_id || !item.occurred_at) return null;
  return {
    id: item.activity_id,
    occurredAt: item.occurred_at,
    actorDisplayName: text(item.actor_display_name, "System"),
    actorRole: text(item.actor_role, "system"),
    action: text(item.action, "activity.recorded"),
    entityType: text(item.entity_type, "entity"),
    entityId: item.entity_id,
    outcome:
      item.outcome === "denied" || item.outcome === "failed"
        ? item.outcome
        : "success",
  };
};

export const mapRegistrarWorkspace = ({
  summary,
  attentionItems,
  activity,
}: RegistrarWorkspaceSource): RegistrarWorkspace | null => {
  if (!summary?.institution_id) return null;

  return {
    institutionId: summary.institution_id,
    institutionName: text(summary.institution_name, "Institution"),
    termId: summary.term_id,
    termName: summary.term_name,
    termStatus: summary.term_status,
    startsOn: summary.starts_on,
    endsOn: summary.ends_on,
    registrationOpensAt: summary.registration_opens_at,
    registrationClosesAt: summary.registration_closes_at,
    addDropDeadline: summary.add_drop_deadline,
    withdrawalDeadline: summary.withdrawal_deadline,
    gradesDueAt: summary.grades_due_at,
    activeStudentCount: number(summary.active_student_count),
    courseSectionCount: number(summary.course_section_count),
    recordsAwaitingPublication: number(summary.records_awaiting_publication),
    attentionItems: attentionItems
      .map(mapAttentionItem)
      .filter((item): item is RegistrarAttentionItem => item !== null),
    recentActivity: activity
      .map(mapRegistrarActivity)
      .filter((item): item is RegistrarActivity => item !== null),
  };
};

export class SupabaseRegistrarWorkspaceRepository
  implements RegistrarWorkspaceRepository
{
  async getForUser(userId: string): Promise<RegistrarWorkspace | null> {
    if (!userId) return null;
    const supabase = await createClient();
    const summaryResult = await supabase
      .from("registrar_workspace_summary")
      .select("*")
      .maybeSingle();

    if (summaryResult.error) {
      logEvent("error", "registrar_workspace_summary_failed", {
        category: summaryResult.error.code,
      });
      throw new Error("The registrar workspace could not be loaded.");
    }

    if (!summaryResult.data?.institution_id) return null;

    const institutionId = summaryResult.data.institution_id;
    const [attentionResult, activityResult] = await Promise.all([
      supabase
        .from("registrar_attention_queue")
        .select("*")
        .eq("institution_id", institutionId)
        .order("submitted_at", { ascending: true }),
      supabase
        .from("registrar_audit_activity")
        .select("*")
        .eq("institution_id", institutionId)
        .order("occurred_at", { ascending: false })
        .limit(6),
    ]);

    if (attentionResult.error || activityResult.error) {
      logEvent("error", "registrar_workspace_detail_failed", {
        category:
          attentionResult.error?.code ??
          activityResult.error?.code ??
          "unknown",
      });
      throw new Error("Registrar workspace details could not be loaded.");
    }

    logEvent("info", "registrar_workspace_loaded", {
      attentionCount: attentionResult.data?.length ?? 0,
    });

    return mapRegistrarWorkspace({
      summary: summaryResult.data,
      attentionItems: attentionResult.data ?? [],
      activity: activityResult.data ?? [],
    });
  }

  async listStudents(institutionId: string): Promise<readonly RegistrarStudent[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("registrar_student_directory")
      .select("*")
      .eq("institution_id", institutionId)
      .order("display_name");

    if (error) throw new Error("The student directory could not be loaded.");

    return (data ?? [])
      .filter((row) => row.student_id && row.display_name && row.student_number)
      .map((row) => ({
        id: row.student_id as string,
        displayName: row.display_name as string,
        studentNumber: row.student_number as string,
        academicStatus: text(row.academic_status, "active"),
        expectedCompletionDate: row.expected_completion_date,
        programName: row.program_name,
        programVersionNumber: row.program_version_number,
      }));
  }

  async listSections(institutionId: string): Promise<readonly RegistrarSection[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("registrar_section_directory")
      .select("*")
      .eq("institution_id", institutionId)
      .order("term_name", { ascending: false })
      .order("course_code");

    if (error) throw new Error("The section directory could not be loaded.");

    return (data ?? [])
      .filter(
        (row) =>
          row.section_id &&
          row.term_id &&
          row.course_id &&
          row.course_code &&
          row.course_title &&
          row.section_code,
      )
      .map((row) => ({
        id: row.section_id as string,
        termId: row.term_id as string,
        termName: text(row.term_name, "Term"),
        courseId: row.course_id as string,
        courseCode: row.course_code as string,
        courseTitle: row.course_title as string,
        sectionCode: row.section_code as string,
        capacity: number(row.capacity),
        enrolledCount: number(row.enrolled_count),
        location: row.location,
        deliveryMode:
          row.delivery_mode === "online" || row.delivery_mode === "hybrid"
            ? row.delivery_mode
            : "in_person",
        status:
          row.status === "planned" ||
          row.status === "closed" ||
          row.status === "cancelled"
            ? row.status
            : "open",
        instructors: text(row.instructors, "Staff not assigned"),
        schedule: text(row.schedule, "Schedule to be announced"),
      }));
  }

  async listActivity(institutionId: string): Promise<readonly RegistrarActivity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("registrar_audit_activity")
      .select("*")
      .eq("institution_id", institutionId)
      .order("occurred_at", { ascending: false })
      .limit(50);

    if (error) throw new Error("Institution activity could not be loaded.");

    return (data ?? [])
      .map(mapRegistrarActivity)
      .filter((item): item is RegistrarActivity => item !== null);
  }
}

const repository = new SupabaseRegistrarWorkspaceRepository();

export const getRegistrarWorkspaceForUser = cache((userId: string) =>
  repository.getForUser(userId),
);
export const getRegistrarStudents = cache((institutionId: string) =>
  repository.listStudents(institutionId),
);
export const getRegistrarSections = cache((institutionId: string) =>
  repository.listSections(institutionId),
);
export const getRegistrarActivity = cache((institutionId: string) =>
  repository.listActivity(institutionId),
);
