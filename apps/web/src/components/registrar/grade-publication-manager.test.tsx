import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GradePublicationManager } from "./grade-publication-manager";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/registrar/records/actions", () => ({
  approveGradeSubmission: vi.fn(),
  publishGradeSubmission: vi.fn(),
  startRegistrarGradeCorrection: vi.fn(),
}));

afterEach(cleanup);

const queue = [
  {
    grade_submission_id: "submission-1",
    institution_id: "institution-1",
    student_id: "student-1",
    student_display_name: "Aisha Rahman",
    course_code: "CS 2305",
    course_title: "Data Structures",
    section_id: "section-1",
    section_code: "01",
    term_name: "Fall 2026",
    state: "submitted" as const,
    grade_code: "B+",
    grade_points: 3.3,
    total_score: 89.2,
    correction_reason_code: null,
    previous_grade_submission_id: null,
    submitted_at: "2026-07-25T10:24:00Z",
    approved_at: null,
    submitted_by_display_name: "Elena Martinez",
    current_grade_record_id: null,
    current_grade_record_version: null,
  },
];

const records = [
  {
    grade_record_id: "record-1",
    institution_id: "institution-1",
    student_id: "student-1",
    course_id: "course-1",
    course_code: "CS 1301",
    course_title: "Introduction to Programming",
    term_name: "Spring 2026",
    attempted_credit_hours: 3,
    credit_hours_earned: 3,
    grade_code: "A",
    grade_points: 4,
    version_number: 1,
    previous_grade_record_id: null,
    correction_reason_code: null,
    is_current: true,
    published_at: "2026-05-22T09:20:00Z",
    superseded_at: null,
    academic_record_version_id: "version-1",
    academic_record_version: 1,
    anchor_status: "not_configured",
    studentDisplayName: "Aisha Rahman",
  },
];

describe("GradePublicationManager", () => {
  it("renders the approval queue and auditable correction controls", () => {
    render(<GradePublicationManager queue={queue} records={records} />);

    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Published record history" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", {
        name: "Correction reason for CS 1301",
      }),
    ).toHaveValue("clerical_error");
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    expect(screen.getByText("not configured")).toBeInTheDocument();
  });

  it("renders the queue empty state without hiding published records", () => {
    render(<GradePublicationManager queue={[]} records={records} />);

    expect(screen.getByText("The queue is clear")).toBeInTheDocument();
    expect(screen.getByText("CS 1301 · A")).toBeInTheDocument();
  });
});
