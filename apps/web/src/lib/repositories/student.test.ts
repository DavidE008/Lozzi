import { describe, expect, it } from "vitest";

import { mapStudentDashboard } from "./student";

const summary = {
  student_id: "student-1",
  display_name: "Aisha Rahman",
  initials: "AR",
  institution_name: "Northstar University",
  program_name: "Computer Science",
  academic_status: "active",
  gpa: 4,
  credits_earned: 3,
  credits_required: 120,
  progress_percent: 3,
  active_hold_count: 0,
};

describe("mapStudentDashboard", () => {
  it("maps stored rows into the stable domain model", () => {
    const result = mapStudentDashboard({
      summary,
      courses: [
        {
          code: "CS 2305",
          title: "Data Structures",
          section_code: "001",
          schedule: "Mon / 10:00 AM-11:15 AM",
          location: "Innovation Hall 204",
          instructor: "Elena Martinez",
        },
      ],
      activities: [
        {
          activity_id: "activity-1",
          title: "Enrollment confirmed",
          detail: "CS 2305 / Data Structures",
          occurred_at: "2026-07-01T00:00:00Z",
          tone: "teal",
        },
      ],
    });

    expect(result).toMatchObject({
      displayName: "Aisha Rahman",
      gpa: 4,
      creditsEarned: 3,
      creditsRequired: 120,
      activeHolds: 0,
    });
    expect(result?.currentCourses[0]?.code).toBe("CS 2305");
  });

  it("returns null when no scoped student exists", () => {
    expect(
      mapStudentDashboard({
        summary: { ...summary, student_id: null },
        courses: [],
        activities: [],
      }),
    ).toBeNull();
  });
});
