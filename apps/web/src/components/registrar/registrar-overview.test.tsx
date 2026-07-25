import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RegistrarOverview } from "./registrar-overview";

const workspace = {
  institutionId: "institution-1",
  institutionName: "Northstar University",
  termId: "term-1",
  termName: "Fall 2026",
  termStatus: "registration_open",
  startsOn: "2026-08-24",
  endsOn: "2026-12-20",
  registrationOpensAt: "2026-04-01T08:00:00Z",
  registrationClosesAt: "2026-09-06T23:59:59Z",
  addDropDeadline: "2026-09-06T23:59:59Z",
  withdrawalDeadline: "2026-11-15T23:59:59Z",
  gradesDueAt: "2026-12-18T23:59:59Z",
  activeStudentCount: 3,
  courseSectionCount: 2,
  recordsAwaitingPublication: 1,
  attentionItems: [
    {
      id: "item-1",
      studentId: "student-1",
      studentDisplayName: "Mateo Silva",
      recordType: "Grade record",
      courseCode: "CS 1301",
      courseTitle: "Introduction to Programming",
      submittedByDisplayName: "Elena Martinez",
      submittedAt: "2026-05-22T09:20:00Z",
      status: "approved" as const,
      versionNumber: 1,
    },
  ],
  recentActivity: [],
};

afterEach(cleanup);

describe("RegistrarOverview", () => {
  it("renders the scoped summary and keeps future publication disabled", () => {
    render(<RegistrarOverview workspace={workspace} />);

    expect(
      screen.getByRole("heading", { name: "Registrar workspace" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Mateo Silva")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publish record" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /View all/u })).toHaveAttribute(
      "href",
      "/registrar/records",
    );
  });

  it("renders accessible empty states", () => {
    render(
      <RegistrarOverview
        workspace={{ ...workspace, attentionItems: [], recentActivity: [] }}
      />,
    );

    expect(screen.getByText("No records need attention")).toBeInTheDocument();
    expect(
      screen.getByText("Audited catalog and term changes will appear here."),
    ).toBeInTheDocument();
  });
});
