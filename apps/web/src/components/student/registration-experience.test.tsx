import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RegistrationCatalog } from "@/lib/repositories/registration";

import { submitRegistration } from "@/app/student/register/actions";
import { RegistrationExperience } from "./registration-experience";

vi.mock("@/app/student/register/actions", () => ({
  submitRegistration: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const catalog: RegistrationCatalog = {
  studentId: "student-1",
  institutionId: "institution-1",
  termId: "term-1",
  termName: "Fall 2026",
  registrationClosesAt: "2026-09-06T23:59:59Z",
  addDropDeadline: "2026-09-06T23:59:59Z",
  courses: [
    {
      id: "course-1",
      code: "CS 2305",
      title: "Data Structures",
      creditHours: 3,
      prerequisites: [
        {
          courseId: "course-0",
          code: "CS 1301",
          title: "Introduction to Programming",
          kind: "prerequisite",
        },
      ],
      sections: [
        {
          id: "section-1",
          code: "01",
          capacity: 24,
          enrolledCount: 23,
          availableSeats: 1,
          location: "Computing Hall 204",
          deliveryMode: "in_person",
          status: "open",
          instructor: "Elena Martinez",
          meetings: [
            {
              weekday: 1,
              startsAt: "10:00:00",
              endsAt: "11:15:00",
              location: "Computing Hall 204",
            },
          ],
          enrollmentId: null,
          enrollmentStatus: null,
          eligibility: {
            eligible: true,
            blockingReasons: [],
            warnings: [
              {
                code: "LIMITED_SEATS",
                message: "Only a few seats remain in this section.",
                relatedEntityId: "section-1",
              },
            ],
          },
        },
      ],
    },
    {
      id: "course-2",
      code: "CS 3300",
      title: "Algorithms",
      creditHours: 3,
      prerequisites: [],
      sections: [
        {
          id: "section-2",
          code: "01",
          capacity: 24,
          enrolledCount: 10,
          availableSeats: 14,
          location: "Computing Hall 310",
          deliveryMode: "in_person",
          status: "open",
          instructor: "James Wilson",
          meetings: [],
          enrollmentId: null,
          enrollmentStatus: null,
          eligibility: {
            eligible: false,
            blockingReasons: [
              {
                code: "MISSING_PREREQUISITE",
                message:
                  "Algorithms requires completion of CS 2305 Data Structures.",
                relatedEntityId: "course-1",
              },
            ],
            warnings: [],
          },
        },
      ],
    },
  ],
};

describe("RegistrationExperience", () => {
  it("renders the catalog with labelled, expanded eligibility details", () => {
    render(<RegistrationExperience catalog={catalog} />);

    expect(
      screen.getByRole("heading", { name: "Register for Classes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /CS 2305 Data Structures/ }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("heading", { name: "Eligibility check" }),
    ).toBeInTheDocument();
  });

  it("filters courses by code or title", () => {
    render(<RegistrationExperience catalog={catalog} />);

    fireEvent.change(screen.getByLabelText("Course search"), {
      target: { value: "Algorithms" },
    });

    expect(screen.getByText("Algorithms")).toBeInTheDocument();
    expect(screen.queryByText("Data Structures")).not.toBeInTheDocument();
  });

  it("submits an eligible planned section and reports success", async () => {
    vi.mocked(submitRegistration).mockResolvedValue({
      success: true,
      message: "Registration submitted successfully.",
    });
    render(<RegistrationExperience catalog={catalog} />);

    fireEvent.click(screen.getByRole("button", { name: "Add CS 2305" }));
    expect(
      screen.getByText("Total planned credits").nextSibling,
    ).toHaveTextContent("3 / 18");
    fireEvent.click(screen.getByRole("button", { name: "Review and Submit" }));

    await waitFor(() => expect(submitRegistration).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText("Registration submitted successfully."),
    ).toBeInTheDocument();
  });

  it("shows a grounded empty state when no term is available", () => {
    render(<RegistrationExperience catalog={null} />);

    expect(
      screen.getByRole("heading", { name: "Registration is not available" }),
    ).toBeInTheDocument();
  });
});
