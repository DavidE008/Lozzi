import { describe, expect, it } from "vitest";

import {
  mapInstructorGradebook,
  mapInstructorSections,
  mapStudentDegreeProgress,
} from "./grades";

const section = {
  section_id: "section-1",
  institution_id: "institution-1",
  institution_name: "Northstar University",
  term_id: "term-1",
  term_name: "Fall 2026",
  course_code: "CS 2305",
  course_title: "Data Structures",
  section_code: "01",
  capacity: 12,
  roster_count: 1,
  location: "Computing Hall 204",
  section_status: "open",
  schedule: "Mon 10:00 AM–11:15 AM",
  lifecycle_state: "draft" as const,
  last_saved_at: "2026-07-25T10:24:00Z",
};

describe("grade repository mapping", () => {
  it("maps instructor section rows without inventing data", () => {
    expect(mapInstructorSections([section])).toEqual([section]);
  });

  it("repairs legacy schedule typography at the read boundary", () => {
    const legacySchedule =
      "Mon 10:00 AM\u00e2\u20ac\u201c11:15 AM \u00c2\u00b7 Wed 10:00 AM\u00e2\u20ac\u201c11:15 AM";

    expect(
      mapInstructorSections([{ ...section, schedule: legacySchedule }])[0]
        ?.schedule,
    ).toBe("Mon 10:00 AM–11:15 AM · Wed 10:00 AM–11:15 AM");
  });

  it("maps a complete gradebook row and derives the lifecycle", () => {
    const result = mapInstructorGradebook(section, [
      {
        section_id: "section-1",
        institution_id: "institution-1",
        institution_name: "Northstar University",
        term_id: "term-1",
        term_name: "Fall 2026",
        course_code: "CS 2305",
        course_title: "Data Structures",
        section_code: "01",
        location: "Computing Hall 204",
        schedule: "Mon 10:00 AM–11:15 AM",
        enrollment_id: "enrollment-1",
        student_id: "student-1",
        student_display_name: "Aisha Rahman",
        student_initials: "AR",
        grade_submission_id: "submission-1",
        previous_grade_submission_id: null,
        lifecycle_state: "draft",
        participation_score: 9,
        assignment_average: 88,
        final_exam_score: 90,
        total_score: 89.2,
        grade_code: "B+",
        grade_points: 3.3,
        correction_reason_code: null,
        draft_revision: 1,
        last_saved_at: "2026-07-25T10:24:00Z",
        current_grade_record_id: null,
        current_grade_record_version: null,
        row_status: "complete",
      },
    ]);

    expect(result.lifecycleState).toBe("draft");
    expect(result.rows[0]).toMatchObject({
      student_display_name: "Aisha Rahman",
      total_score: 89.2,
      grade_code: "B+",
      row_status: "complete",
    });
  });

  it("normalizes legacy degree requirements into a visible group", () => {
    const progress = mapStudentDegreeProgress({
      student_id: "student-1",
      institution_id: "institution-1",
      program_name: "Bachelor of Science in Computer Science",
      program_version: 1,
      degree_audit_snapshot_id: "snapshot-1",
      academic_record_version_id: "version-1",
      credits_earned: 3,
      credits_required: 120,
      gpa: 4,
      progress_percent: 3,
      requirement_results: [
        { code: "CS 1301", status: "complete" },
        { code: "CS 2305", status: "in-progress" },
      ],
      calculated_at: "2026-05-21T11:06:00Z",
    });

    expect(progress?.requirement_results).toEqual([
      {
        code: "CS 1301",
        status: "complete",
        group: "Program requirements",
      },
      {
        code: "CS 2305",
        status: "in-progress",
        group: "Program requirements",
      },
    ]);
  });
});
