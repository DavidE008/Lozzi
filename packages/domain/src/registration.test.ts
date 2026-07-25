import { describe, expect, it } from "vitest";

import {
  EnrollmentEligibilityService,
  type EnrollmentEligibilityInput,
} from "./registration";

const eligibleInput = (
  overrides: Partial<EnrollmentEligibilityInput> = {},
): EnrollmentEligibilityInput => ({
  now: "2026-07-25T12:00:00.000Z",
  studentId: "student-1",
  studentAcademicStatus: "active",
  studentProgramCode: "BSCS",
  termId: "term-1",
  termStatus: "registration_open",
  registrationOpensAt: "2026-04-01T08:00:00.000Z",
  registrationClosesAt: "2026-09-06T23:59:59.000Z",
  maxCredits: 18,
  sectionId: "section-1",
  sectionStatus: "open",
  capacity: 24,
  enrolledCount: 10,
  courseId: "course-1",
  courseTitle: "Data Structures",
  courseCredits: 3,
  repeatRestricted: true,
  alreadyEnrolled: false,
  alreadyCompleted: false,
  currentCredits: 3,
  selectedCredits: 0,
  blockingHoldId: null,
  requirements: [
    {
      courseId: "course-prerequisite",
      code: "CS 1301",
      title: "Introduction to Programming",
      kind: "prerequisite",
      minimumGradePoints: 2,
      satisfied: true,
    },
  ],
  targetMeetings: [
    {
      sectionId: "section-1",
      weekday: 1,
      startsAt: "10:00",
      endsAt: "11:15",
    },
  ],
  otherMeetings: [],
  restrictions: {},
  ...overrides,
});

describe("EnrollmentEligibilityService", () => {
  const service = new EnrollmentEligibilityService();

  it("accepts an eligible student and preserves limited-seat warnings", () => {
    const result = service.evaluate(eligibleInput({ enrolledCount: 22 }));

    expect(result.eligible).toBe(true);
    expect(result.blockingReasons).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: "LIMITED_SEATS" }),
    ]);
  });

  it("returns stable reasons for holds, prerequisites, and a closed window", () => {
    const result = service.evaluate(
      eligibleInput({
        termStatus: "closed",
        blockingHoldId: "hold-1",
        requirements: [
          {
            courseId: "course-prerequisite",
            code: "CS 1301",
            title: "Introduction to Programming",
            kind: "prerequisite",
            minimumGradePoints: 2,
            satisfied: false,
          },
        ],
      }),
    );

    expect(result.eligible).toBe(false);
    expect(result.blockingReasons.map(({ code }) => code)).toEqual([
      "REGISTRATION_CLOSED",
      "MISSING_PREREQUISITE",
      "BLOCKING_HOLD",
    ]);
  });

  it("detects touching versus overlapping meetings correctly", () => {
    const noConflict = service.evaluate(
      eligibleInput({
        otherMeetings: [
          {
            sectionId: "section-2",
            weekday: 1,
            startsAt: "11:15",
            endsAt: "12:30",
          },
        ],
      }),
    );
    const conflict = service.evaluate(
      eligibleInput({
        otherMeetings: [
          {
            sectionId: "section-2",
            weekday: 1,
            startsAt: "11:00",
            endsAt: "12:15",
          },
        ],
      }),
    );

    expect(noConflict.eligible).toBe(true);
    expect(conflict.blockingReasons).toEqual([
      expect.objectContaining({
        code: "SCHEDULE_CONFLICT",
        relatedEntityId: "section-2",
      }),
    ]);
  });

  it("combines credit, duplicate, repeat, and section restrictions", () => {
    const result = service.evaluate(
      eligibleInput({
        currentCredits: 15,
        selectedCredits: 3,
        alreadyEnrolled: true,
        alreadyCompleted: true,
        restrictions: {
          allowedProgramCodes: ["BAMATH"],
          unsupportedKeys: ["cohort"],
        },
      }),
    );

    expect(result.blockingReasons.map(({ code }) => code)).toEqual([
      "DUPLICATE_ENROLLMENT",
      "COURSE_ALREADY_COMPLETED",
      "MAX_CREDIT_LOAD",
      "UNSUPPORTED_SECTION_RESTRICTION",
      "SECTION_RESTRICTION",
    ]);
  });
});
