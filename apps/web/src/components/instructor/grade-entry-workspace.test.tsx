import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GradeEntryWorkspace } from "./grade-entry-workspace";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/instructor/sections/[sectionId]/grades/actions", () => ({
  saveGradeDrafts: vi.fn(),
  submitSectionGrades: vi.fn(),
}));

const gradebook = {
  section: {
    section_id: "60000000-0000-4000-8000-000000000001",
    institution_id: "institution-1",
    institution_name: "Northstar University",
    term_id: "term-1",
    term_name: "Fall 2026",
    course_code: "CS 2305",
    course_title: "Data Structures",
    section_code: "01",
    capacity: 2,
    roster_count: 1,
    location: "Computing Hall 204",
    section_status: "open",
    schedule: "Mon 10:00 AM–11:15 AM",
    lifecycle_state: "draft" as const,
    last_saved_at: "2026-07-25T10:24:00Z",
  },
  lifecycleState: "draft" as const,
  rows: [
    {
      section_id: "60000000-0000-4000-8000-000000000001",
      institution_id: "institution-1",
      institution_name: "Northstar University",
      term_id: "term-1",
      term_name: "Fall 2026",
      course_code: "CS 2305",
      course_title: "Data Structures",
      section_code: "01",
      location: "Computing Hall 204",
      schedule: "Mon 10:00 AM–11:15 AM",
      enrollment_id: "70000000-0000-4000-8000-000000000001",
      student_id: "student-1",
      student_display_name: "Aisha Rahman",
      student_initials: "AR",
      grade_submission_id: "submission-1",
      previous_grade_submission_id: null,
      lifecycle_state: "draft" as const,
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
      row_status: "complete" as const,
    },
  ],
};

describe("GradeEntryWorkspace", () => {
  it("renders the approved lifecycle, labelled inputs, and derived grade", () => {
    render(<GradeEntryWorkspace gradebook={gradebook} />);

    expect(
      screen.getByRole("heading", {
        name: "CS 2305 · Data Structures",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("You can only manage this section."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", {
        name: "Aisha Rahman participation score out of 10",
      }),
    ).toHaveValue(9);
    expect(screen.getByText("89.2")).toBeInTheDocument();
    expect(screen.getByText("B+")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit grades" })).toBeEnabled();
  });
});
