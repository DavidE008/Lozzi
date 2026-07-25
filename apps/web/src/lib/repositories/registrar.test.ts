import { describe, expect, it } from "vitest";

import { mapRegistrarWorkspace } from "./registrar";

describe("mapRegistrarWorkspace", () => {
  it("maps real view rows into the stable registrar model", () => {
    const result = mapRegistrarWorkspace({
      summary: {
        institution_id: "institution-1",
        institution_name: "Northstar University",
        term_id: "term-1",
        term_name: "Fall 2026",
        term_status: "registration_open",
        starts_on: "2026-08-24",
        ends_on: "2026-12-20",
        registration_opens_at: "2026-04-01T08:00:00Z",
        registration_closes_at: "2026-09-06T23:59:59Z",
        add_drop_deadline: "2026-09-06T23:59:59Z",
        withdrawal_deadline: "2026-11-15T23:59:59Z",
        grades_due_at: "2026-12-18T23:59:59Z",
        active_student_count: 3,
        course_section_count: 2,
        records_awaiting_publication: 1,
      },
      attentionItems: [
        {
          item_id: "item-1",
          student_id: "student-1",
          student_display_name: "Mateo Silva",
          record_type: "Grade record",
          course_code: "CS 1301",
          course_title: "Introduction to Programming",
          submitted_by_display_name: "Elena Martinez",
          submitted_at: "2026-05-22T09:20:00Z",
          status: "approved",
          version_number: 1,
        },
      ],
      activity: [],
    });

    expect(result).toMatchObject({
      institutionName: "Northstar University",
      activeStudentCount: 3,
      courseSectionCount: 2,
      recordsAwaitingPublication: 1,
    });
    expect(result?.attentionItems[0]).toMatchObject({
      studentDisplayName: "Mateo Silva",
      status: "approved",
    });
  });

  it("returns null when RLS exposes no institution", () => {
    expect(
      mapRegistrarWorkspace({
        summary: null,
        attentionItems: [],
        activity: [],
      }),
    ).toBeNull();
  });
});
