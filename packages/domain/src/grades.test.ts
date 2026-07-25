import { describe, expect, it } from "vitest";

import {
  buildAcademicRecordCommitmentPayload,
  calculateDegreeAudit,
  calculateGpa,
  calculateGrade,
  type PublishedGrade,
} from "./grades";

const currentGrade = (
  overrides: Partial<PublishedGrade> = {},
): PublishedGrade => ({
  courseId: "course-1",
  courseCode: "CS 1301",
  versionNumber: 1,
  gradeCode: "A",
  gradePoints: 4,
  attemptedCredits: 3,
  earnedCredits: 3,
  publishedAt: "2026-05-21T11:00:00.000Z",
  current: true,
  ...overrides,
});

describe("grade calculation", () => {
  it("calculates the approved 10/40/50 weighting and grade band", () => {
    expect(
      calculateGrade({
        participationScore: 9,
        assignmentAverage: 88,
        finalExamScore: 90,
      }),
    ).toEqual({
      complete: true,
      totalScore: 89.2,
      gradeCode: "B+",
      gradePoints: 3.3,
      missingFields: [],
    });
  });

  it("keeps an incomplete draft honest", () => {
    expect(
      calculateGrade({
        participationScore: 8,
        assignmentAverage: 76,
        finalExamScore: null,
      }),
    ).toEqual({
      complete: false,
      totalScore: null,
      gradeCode: null,
      gradePoints: null,
      missingFields: ["finalExamScore"],
    });
  });

  it("rejects component scores outside their declared ranges", () => {
    expect(() =>
      calculateGrade({
        participationScore: 11,
        assignmentAverage: 88,
        finalExamScore: 90,
      }),
    ).toThrow();
  });
});

describe("GPA and degree audit", () => {
  it("uses current versions and attempted-credit weighting", () => {
    expect(
      calculateGpa([
        currentGrade(),
        currentGrade({
          courseId: "course-2",
          courseCode: "CS 2305",
          gradeCode: "A-",
          gradePoints: 3.7,
        }),
        currentGrade({
          versionNumber: 1,
          gradeCode: "B",
          gradePoints: 3,
          current: false,
        }),
      ]),
    ).toBe(3.85);
  });

  it("calculates earned credits, progress, and requirement states", () => {
    expect(
      calculateDegreeAudit({
        creditsRequired: 120,
        publishedGrades: [currentGrade()],
        inProgressCourseIds: ["course-2"],
        requirements: [
          {
            id: "requirement-2",
            group: "Computer science core",
            courseId: "course-2",
            courseCode: "CS 2305",
            courseTitle: "Data Structures",
            credits: 3,
          },
          {
            id: "requirement-1",
            group: "Computer science core",
            courseId: "course-1",
            courseCode: "CS 1301",
            courseTitle: "Introduction to Programming",
            credits: 3,
          },
        ],
      }),
    ).toMatchObject({
      creditsEarned: 3,
      gpa: 4,
      progressPercent: 2.5,
      requirements: [
        { courseCode: "CS 1301", status: "complete" },
        { courseCode: "CS 2305", status: "in-progress" },
      ],
    });
  });
});

describe("academic record commitment payload", () => {
  it("excludes historical versions and sorts current records deterministically", () => {
    const payload = buildAcademicRecordCommitmentPayload({
      pseudonymousStudentId: "urn:lozzi:student:synthetic-aisha",
      records: [
        currentGrade({
          courseId: "course-2",
          courseCode: "CS 2305",
          versionNumber: 2,
        }),
        currentGrade({ current: false }),
        currentGrade(),
      ],
    });

    expect(payload.student).toBe("urn:lozzi:student:synthetic-aisha");
    expect(payload.records.map(({ courseCode }) => courseCode)).toEqual([
      "CS 1301",
      "CS 2305",
    ]);
    expect(JSON.stringify(payload)).not.toContain("student_number");
  });
});
