import { describe, expect, it } from "vitest";

import { mapRegistrationCatalog } from "./registration";

const eligibility = {
  eligible: true,
  blockingReasons: [],
  warnings: [],
};

describe("mapRegistrationCatalog", () => {
  it("groups sections under a course without losing enrollment state", () => {
    const catalog = mapRegistrationCatalog([
      {
        student_id: "student-1",
        institution_id: "institution-1",
        term_id: "term-1",
        term_name: "Fall 2026",
        registration_closes_at: "2026-09-06T23:59:59Z",
        add_drop_deadline: "2026-09-06T23:59:59Z",
        section_id: "section-1",
        course_id: "course-1",
        course_code: "CS 2305",
        course_title: "Data Structures",
        credit_hours: 3,
        section_code: "01",
        capacity: 24,
        enrolled_count: 23,
        available_seats: 1,
        location: "Computing Hall 204",
        delivery_mode: "in_person",
        section_status: "open",
        instructor: "Elena Martinez",
        meetings: [
          {
            weekday: 1,
            startsAt: "10:00:00",
            endsAt: "11:15:00",
            location: "Computing Hall 204",
          },
        ],
        prerequisites: [
          {
            courseId: "course-0",
            code: "CS 1301",
            title: "Introduction to Programming",
            kind: "prerequisite",
          },
        ],
        enrollment_id: "enrollment-1",
        enrollment_status: "enrolled",
        eligibility,
      },
      {
        student_id: "student-1",
        institution_id: "institution-1",
        term_id: "term-1",
        term_name: "Fall 2026",
        registration_closes_at: "2026-09-06T23:59:59Z",
        add_drop_deadline: "2026-09-06T23:59:59Z",
        section_id: "section-2",
        course_id: "course-1",
        course_code: "CS 2305",
        course_title: "Data Structures",
        credit_hours: 3,
        section_code: "02",
        capacity: 20,
        enrolled_count: 10,
        available_seats: 10,
        location: null,
        delivery_mode: "online",
        section_status: "open",
        instructor: "James Wilson",
        meetings: [],
        prerequisites: [],
        enrollment_id: null,
        enrollment_status: null,
        eligibility,
      },
    ]);

    expect(catalog).toMatchObject({
      termName: "Fall 2026",
      courses: [
        {
          code: "CS 2305",
          sections: [
            { code: "01", enrollmentStatus: "enrolled" },
            { code: "02", enrollmentStatus: null },
          ],
        },
      ],
    });
  });

  it("returns null for an academic term with no offerings", () => {
    expect(mapRegistrationCatalog([])).toBeNull();
  });
});

