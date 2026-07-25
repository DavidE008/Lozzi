import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardView } from "./dashboard-view";

const dashboard = {
  studentId: "student-1",
  displayName: "Aisha Rahman",
  initials: "AR",
  institutionName: "Northstar University",
  programName: "Computer Science",
  academicStanding: "active",
  gpa: 4,
  creditsEarned: 3,
  creditsRequired: 120,
  progressPercent: 3,
  activeHolds: 0,
  currentCourses: [
    {
      code: "CS 2305",
      title: "Data Structures",
      section: "001",
      schedule: "Mon / 10:00 AM-11:15 AM",
      location: "Innovation Hall 204",
      instructor: "Elena Martinez",
    },
  ],
  recentActivity: [],
} as const;

describe("DashboardView", () => {
  it("renders the approved academic summary accessibly", () => {
    render(<DashboardView dashboard={dashboard} />);

    expect(screen.getByRole("heading", { name: "Welcome back, Aisha" })).toBeVisible();
    expect(screen.getByText("4.00")).toBeVisible();
    expect(screen.getByText("CS 2305")).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-label", "3% degree progress");
    expect(screen.getByText("No recent academic activity.")).toBeVisible();
  });

  it("renders a useful empty course state", () => {
    render(<DashboardView dashboard={{ ...dashboard, currentCourses: [] }} />);
    expect(screen.getByText("No current courses")).toBeVisible();
  });
});
