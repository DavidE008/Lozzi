import {
  buildAcademicRecordCommitmentPayload,
  type GradeLifecycleState,
  type PublishedGrade,
} from "@lozzi/domain";
import { cache } from "react";
import { z } from "zod";

import { logEvent } from "@/lib/logging";
import { createClient } from "@/lib/supabase/server";

const lifecycleSchema = z.enum([
  "draft",
  "submitted",
  "approved",
  "published",
]);

const instructorSectionRowSchema = z.object({
  section_id: z.string(),
  institution_id: z.string(),
  institution_name: z.string(),
  term_id: z.string(),
  term_name: z.string(),
  course_code: z.string(),
  course_title: z.string(),
  section_code: z.string(),
  capacity: z.number().int(),
  roster_count: z.number().int(),
  location: z.string().nullable(),
  section_status: z.string(),
  schedule: z.string(),
  lifecycle_state: lifecycleSchema,
  last_saved_at: z.string().nullable(),
});

const gradebookRowSchema = z.object({
  section_id: z.string(),
  institution_id: z.string(),
  institution_name: z.string(),
  term_id: z.string(),
  term_name: z.string(),
  course_code: z.string(),
  course_title: z.string(),
  section_code: z.string(),
  location: z.string().nullable(),
  schedule: z.string(),
  enrollment_id: z.string(),
  student_id: z.string(),
  student_display_name: z.string(),
  student_initials: z.string(),
  grade_submission_id: z.string().nullable(),
  previous_grade_submission_id: z.string().nullable(),
  lifecycle_state: lifecycleSchema,
  participation_score: z.coerce.number().nullable(),
  assignment_average: z.coerce.number().nullable(),
  final_exam_score: z.coerce.number().nullable(),
  total_score: z.coerce.number().nullable(),
  grade_code: z.string().nullable(),
  grade_points: z.coerce.number().nullable(),
  correction_reason_code: z.string().nullable(),
  draft_revision: z.number().int().nullable(),
  last_saved_at: z.string().nullable(),
  current_grade_record_id: z.string().nullable(),
  current_grade_record_version: z.number().int().nullable(),
  row_status: z.enum([
    "not_started",
    "needs_attention",
    "complete",
    "submitted",
    "approved",
    "published",
  ]),
});

const registrarGradeRowSchema = z.object({
  grade_submission_id: z.string(),
  institution_id: z.string(),
  student_id: z.string(),
  student_display_name: z.string(),
  course_code: z.string(),
  course_title: z.string(),
  section_id: z.string(),
  section_code: z.string(),
  term_name: z.string(),
  state: z.enum(["submitted", "approved"]),
  grade_code: z.string(),
  grade_points: z.coerce.number(),
  total_score: z.coerce.number(),
  correction_reason_code: z.string().nullable(),
  previous_grade_submission_id: z.string().nullable(),
  submitted_at: z.string(),
  approved_at: z.string().nullable(),
  submitted_by_display_name: z.string(),
  current_grade_record_id: z.string().nullable(),
  current_grade_record_version: z.number().int().nullable(),
});

const academicRecordRowSchema = z.object({
  grade_record_id: z.string(),
  institution_id: z.string(),
  student_id: z.string(),
  course_id: z.string(),
  course_code: z.string(),
  course_title: z.string(),
  term_name: z.string(),
  attempted_credit_hours: z.coerce.number(),
  credit_hours_earned: z.coerce.number(),
  grade_code: z.string(),
  grade_points: z.coerce.number(),
  version_number: z.number().int(),
  previous_grade_record_id: z.string().nullable(),
  correction_reason_code: z.string().nullable(),
  is_current: z.boolean(),
  published_at: z.string(),
  superseded_at: z.string().nullable(),
  academic_record_version_id: z.string().nullable(),
  academic_record_version: z.number().int().nullable(),
  anchor_status: z.string().nullable(),
});

const progressRowSchema = z.object({
  student_id: z.string(),
  institution_id: z.string(),
  program_name: z.string(),
  program_version: z.number().int(),
  degree_audit_snapshot_id: z.string(),
  academic_record_version_id: z.string(),
  credits_earned: z.coerce.number(),
  credits_required: z.coerce.number(),
  gpa: z.coerce.number().nullable(),
  progress_percent: z.coerce.number(),
  requirement_results: z.array(
    z.object({
      requirementId: z.string().optional(),
      group: z.string(),
      courseId: z.string().optional(),
      code: z.string(),
      title: z.string().optional(),
      credits: z.coerce.number().optional(),
      status: z.enum(["complete", "in-progress", "remaining"]),
    }),
  ),
  calculated_at: z.string(),
});

export type InstructorSection = z.infer<typeof instructorSectionRowSchema>;
export type InstructorGradeRow = z.infer<typeof gradebookRowSchema>;
export type RegistrarGradeItem = z.infer<typeof registrarGradeRowSchema>;
export type StudentAcademicRecord = z.infer<typeof academicRecordRowSchema>;
export type StudentDegreeProgress = z.infer<typeof progressRowSchema>;

export interface InstructorGradebook {
  readonly section: InstructorSection;
  readonly rows: readonly InstructorGradeRow[];
  readonly lifecycleState: GradeLifecycleState;
}

interface QueryResult {
  readonly data: unknown;
  readonly error: { readonly code?: string } | null;
}

interface QueryBuilder extends PromiseLike<QueryResult> {
  select(columns?: string): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  order(
    column: string,
    options?: { readonly ascending?: boolean },
  ): QueryBuilder;
  limit(count: number): QueryBuilder;
  maybeSingle(): Promise<QueryResult>;
}

interface GradesQueryClient {
  from(table: string): QueryBuilder;
}

const queryClient = async () =>
  (await createClient()) as unknown as GradesQueryClient;

const reportReadError = (event: string, error: QueryResult["error"]) => {
  logEvent("error", event, { category: error?.code ?? "unknown" });
};

export const mapInstructorSections = (
  source: unknown,
): readonly InstructorSection[] =>
  z.array(instructorSectionRowSchema).parse(source);

export const mapInstructorGradebook = (
  section: InstructorSection,
  source: unknown,
): InstructorGradebook => {
  const rows = z.array(gradebookRowSchema).parse(source);
  const lifecycleState =
    rows.find(({ lifecycle_state }) => lifecycle_state === "draft")
      ?.lifecycle_state ??
    rows.find(({ lifecycle_state }) => lifecycle_state === "submitted")
      ?.lifecycle_state ??
    rows.find(({ lifecycle_state }) => lifecycle_state === "approved")
      ?.lifecycle_state ??
    rows[0]?.lifecycle_state ??
    section.lifecycle_state;

  return { section, rows, lifecycleState };
};

export const getInstructorSections = cache(async () => {
  const client = await queryClient();
  const { data, error } = await client
    .from("instructor_assigned_sections")
    .select("*")
    .order("term_name", { ascending: false })
    .order("course_code");

  if (error) {
    reportReadError("instructor_sections_failed", error);
    throw new Error("Assigned sections could not be loaded.");
  }

  return mapInstructorSections(data ?? []);
});

export const getInstructorGradebook = cache(async (sectionId: string) => {
  const sections = await getInstructorSections();
  const section = sections.find(({ section_id }) => section_id === sectionId);
  if (!section) return null;

  const client = await queryClient();
  const { data, error } = await client
    .from("instructor_section_gradebook")
    .select("*")
    .eq("section_id", sectionId)
    .order("student_display_name");

  if (error) {
    reportReadError("instructor_gradebook_failed", error);
    throw new Error("The assigned gradebook could not be loaded.");
  }

  return mapInstructorGradebook(section, data ?? []);
});

export const getRegistrarGradeQueue = cache(async (institutionId: string) => {
  const client = await queryClient();
  const { data, error } = await client
    .from("registrar_grade_queue")
    .select("*")
    .eq("institution_id", institutionId)
    .order("submitted_at");

  if (error) {
    reportReadError("registrar_grade_queue_failed", error);
    throw new Error("The grade publication queue could not be loaded.");
  }

  return z.array(registrarGradeRowSchema).parse(data ?? []);
});

export const getStudentAcademicRecords = cache(async (studentId: string) => {
  const client = await queryClient();
  const { data, error } = await client
    .from("student_academic_record")
    .select("*")
    .eq("student_id", studentId)
    .order("course_code")
    .order("version_number", { ascending: false });

  if (error) {
    reportReadError("student_academic_record_failed", error);
    throw new Error("The academic record could not be loaded.");
  }

  return z.array(academicRecordRowSchema).parse(data ?? []);
});

export const getStudentDegreeProgress = cache(async (studentId: string) => {
  const client = await queryClient();
  const { data, error } = await client
    .from("student_degree_progress")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) {
    reportReadError("student_degree_progress_failed", error);
    throw new Error("Degree progress could not be loaded.");
  }

  return data ? progressRowSchema.parse(data) : null;
});

const commitmentSubmissionSchema = z.object({
  id: z.string(),
  institution_id: z.string(),
  enrollment_id: z.string(),
  grade_code: z.string(),
  grade_points: z.coerce.number(),
  enrollments: z.object({
    student_id: z.string(),
    credit_hours: z.coerce.number(),
    students: z.object({ pseudonymous_id: z.string() }),
    course_sections: z.object({
      courses: z.object({ id: z.string(), code: z.string() }),
    }),
  }),
});

export interface RecordCommitmentPreview {
  readonly institutionId: string;
  readonly studentId: string;
  readonly payload: ReturnType<typeof buildAcademicRecordCommitmentPayload>;
}

export const getRecordCommitmentPreview = async (
  gradeSubmissionId: string,
): Promise<RecordCommitmentPreview | null> => {
  const client = await queryClient();
  const submissionResult = await client
    .from("grade_submissions")
    .select(
      "id, institution_id, enrollment_id, grade_code, grade_points, enrollments!grade_submissions_enrollment_id_fkey!inner(student_id, credit_hours, students!enrollments_student_id_fkey!inner(pseudonymous_id), course_sections!enrollments_section_id_fkey!inner(courses!course_sections_course_id_fkey!inner(id, code)))",
    )
    .eq("id", gradeSubmissionId)
    .maybeSingle();

  if (submissionResult.error) {
    reportReadError("record_commitment_submission_failed", submissionResult.error);
    throw new Error("The approved grade could not be prepared.");
  }
  if (!submissionResult.data) return null;

  const submission = commitmentSubmissionSchema.parse(submissionResult.data);
  const existing = await getStudentAcademicRecords(
    submission.enrollments.student_id,
  );
  const nextVersion =
    (existing.find(
      ({ course_id, is_current }) =>
        course_id ===
          submission.enrollments.course_sections.courses.id && is_current,
    )?.version_number ?? 0) + 1;

  const currentRecords: PublishedGrade[] = existing.map((record) => ({
    courseId: record.course_id,
    courseCode: record.course_code,
    versionNumber: record.version_number,
    gradeCode: record.grade_code,
    gradePoints: record.grade_points,
    attemptedCredits: record.attempted_credit_hours,
    earnedCredits: record.credit_hours_earned,
    publishedAt: record.published_at,
    current: record.is_current,
  }));
  currentRecords.push({
    courseId: submission.enrollments.course_sections.courses.id,
    courseCode: submission.enrollments.course_sections.courses.code,
    versionNumber: nextVersion,
    gradeCode: submission.grade_code,
    gradePoints: submission.grade_points,
    attemptedCredits: submission.enrollments.credit_hours,
    earnedCredits:
      submission.grade_points > 0 ? submission.enrollments.credit_hours : 0,
    publishedAt: "",
    current: true,
  });

  return {
    institutionId: submission.institution_id,
    studentId: submission.enrollments.student_id,
    payload: buildAcademicRecordCommitmentPayload({
      pseudonymousStudentId:
        submission.enrollments.students.pseudonymous_id,
      records: currentRecords.filter(
        (record) =>
          record.courseId !==
            submission.enrollments.course_sections.courses.id ||
          record.versionNumber === nextVersion,
      ),
    }),
  };
};

