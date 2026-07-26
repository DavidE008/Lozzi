import {
  sensitiveShareChainStatusSchema,
  shareDisclosureScopeSchema,
  type
  DashboardActivity,
  type
  DashboardCourse,
  type
  StudentDashboard,
  type
  StudentDashboardRepository,
} from "@lozzi/domain";
import { cache } from "react";

import { logEvent } from "@/lib/logging";
import { createClient } from "@/lib/supabase/server";

const requiredText = (value: string | null, fallback: string) => value ?? fallback;

interface DashboardSource {
  readonly summary: {
    readonly student_id: string | null;
    readonly display_name: string | null;
    readonly initials: string | null;
    readonly institution_name: string | null;
    readonly program_name: string | null;
    readonly academic_status: string | null;
    readonly gpa: number | null;
    readonly credits_earned: number | null;
    readonly credits_required: number | null;
    readonly progress_percent: number | null;
    readonly active_hold_count: number | null;
  };
  readonly courses: readonly {
    readonly code: string | null;
    readonly title: string | null;
    readonly section_code: string | null;
    readonly schedule: string | null;
    readonly location: string | null;
    readonly instructor: string | null;
  }[];
  readonly activities: readonly {
    readonly activity_id: string | null;
    readonly title: string | null;
    readonly detail: string | null;
    readonly occurred_at: string | null;
    readonly tone: string | null;
  }[];
}

export const mapStudentDashboard = ({
  summary,
  courses,
  activities,
}: DashboardSource): StudentDashboard | null => {
  if (!summary.student_id) return null;

  const currentCourses: DashboardCourse[] = courses.map((course) => ({
    code: requiredText(course.code, "Course"),
    title: requiredText(course.title, "Untitled course"),
    section: requiredText(course.section_code, "—"),
    schedule: requiredText(course.schedule, "Schedule to be announced"),
    location: requiredText(course.location, "To be announced"),
    instructor: requiredText(course.instructor, "Staff"),
  }));

  const recentActivity: DashboardActivity[] = activities.map((activity) => {
    const occurredAt = requiredText(activity.occurred_at, new Date(0).toISOString());
    return {
      id: requiredText(activity.activity_id, `${summary.student_id}:${occurredAt}`),
      title: requiredText(activity.title, "Academic activity"),
      detail: requiredText(activity.detail, ""),
      occurredAt,
      tone:
        activity.tone === "gold" || activity.tone === "slate" ? activity.tone : "teal",
    };
  });

  return {
    studentId: summary.student_id,
    displayName: requiredText(summary.display_name, "Student"),
    initials: requiredText(summary.initials, "ST"),
    institutionName: requiredText(summary.institution_name, "Institution"),
    programName: requiredText(summary.program_name, "Program not declared"),
    academicStanding: requiredText(summary.academic_status, "active"),
    gpa: Number(summary.gpa ?? 0),
    creditsEarned: Number(summary.credits_earned ?? 0),
    creditsRequired: Number(summary.credits_required ?? 0),
    progressPercent: Number(summary.progress_percent ?? 0),
    activeHolds: summary.active_hold_count ?? 0,
    currentCourses,
    recentActivity,
  };
};

export class SupabaseStudentDashboardRepository implements StudentDashboardRepository {
  async getForUser(userId: string): Promise<StudentDashboard | null> {
    const supabase = await createClient();
    const summaryResult = await supabase
      .from("student_dashboard_summary")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (summaryResult.error) {
      logEvent("error", "student_dashboard_summary_failed", {
        category: summaryResult.error.code,
      });
      throw new Error("The dashboard could not be loaded.");
    }

    const summary = summaryResult.data;
    if (!summary?.student_id) {
      return null;
    }

    const [courseResult, activityResult] = await Promise.all([
      supabase
        .from("student_current_courses")
        .select("*")
        .eq("student_id", summary.student_id)
        .order("code"),
      supabase
        .from("student_recent_activity")
        .select("*")
        .eq("student_id", summary.student_id)
        .order("occurred_at", { ascending: false })
        .limit(5),
    ]);

    if (courseResult.error || activityResult.error) {
      logEvent("error", "student_dashboard_detail_failed", {
        category: courseResult.error?.code ?? activityResult.error?.code ?? "unknown",
      });
      throw new Error("The dashboard details could not be loaded.");
    }

    return mapStudentDashboard({
      summary,
      courses: courseResult.data ?? [],
      activities: activityResult.data ?? [],
    });
  }
}

export const getDashboardForUser = cache((userId: string) =>
  new SupabaseStudentDashboardRepository().getForUser(userId),
);

export const getRecordRows = async (studentId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grade_records")
    .select(
      "id, grade_code, credit_hours_earned, published_at, enrollments!grade_records_enrollment_id_fkey!inner(student_id, course_sections!enrollments_section_id_fkey!inner(courses!course_sections_course_id_fkey!inner(code, title)))",
    )
    .eq("is_current", true)
    .eq("enrollments.student_id", studentId)
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error("Academic records could not be loaded.");
  }
  return data ?? [];
};

export const getShareRows = async (studentId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("record_share_grants")
    .select(
      "id, recipient_label, scopes, status, expires_at, revoked_at, chain_status",
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (error) {
    logEvent("error", "student_share_history_failed", {
      category: error.code ?? "unknown",
    });
    throw new Error("Share history could not be loaded.");
  }
  return (data ?? []).map((share) => ({
    ...share,
    chain_status: sensitiveShareChainStatusSchema.parse(share.chain_status),
    scopes: share.scopes.map((scope) =>
      shareDisclosureScopeSchema.parse(scope),
    ),
  }));
};

export const getCurrentAcademicRecordVersionId = async (
  studentId: string,
): Promise<string | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("academic_record_versions")
    .select("id")
    .eq("student_id", studentId)
    .eq("status", "published")
    .eq("is_current", true)
    .maybeSingle();

  if (error) {
    throw new Error("The current academic record could not be loaded.");
  }
  return data?.id ?? null;
};
