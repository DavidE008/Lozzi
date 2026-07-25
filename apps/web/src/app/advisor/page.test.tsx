import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdvisorDegreePlansPage from "./page";

const repositoryMock = vi.hoisted(() => ({
  getProposals: vi.fn(),
}));

vi.mock("@/app/advisor/actions", () => ({
  reviewDegreePlanProposal: vi.fn(),
}));

vi.mock("@/lib/repositories/advisor", () => ({
  getAdvisorDegreePlanProposals: repositoryMock.getProposals,
}));

describe("AdvisorDegreePlansPage", () => {
  beforeEach(() => {
    repositoryMock.getProposals.mockReset();
  });

  it("renders an assigned proposal with advisory-only controls", async () => {
    repositoryMock.getProposals.mockResolvedValue([
      {
        items: [{ courseCode: "MATH 1314", sortOrder: 1 }],
        proposalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        reviewNote: null,
        reviewedAt: null,
        status: "pending",
        studentDisplayName: "Aisha Rahman",
        studentNumber: "NSU-2026-001",
        submittedAt: "2026-07-25T18:00:00.000Z",
        summary: "Consider Calculus I for the next planning period.",
      },
    ]);

    render(await AdvisorDegreePlansPage());

    expect(
      screen.getByRole("heading", { name: "Aisha Rahman" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1. MATH 1314")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve plan" })).toBeVisible();
    expect(
      screen.getByText(/cannot enroll a student or change an official/u),
    ).toBeVisible();
  });

  it("renders an honest empty review state", async () => {
    repositoryMock.getProposals.mockResolvedValue([]);

    render(await AdvisorDegreePlansPage());

    expect(screen.getByText("No degree plans need review")).toBeInTheDocument();
  });
});
