import {
  createCapability,
  PROGRESS_EXPLANATION_DISCLAIMER,
} from "@lozzi/domain";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProgressExplanationCard } from "./progress-explanation-card";

describe("ProgressExplanationCard", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("honestly disables the workflow when 0G is not configured", () => {
    render(
      <ProgressExplanationCard
        capability={createCapability(
          "zero-g",
          "not-configured",
          "0G private compute",
          "Not configured",
        )}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Explain my progress" }),
    ).toBeDisabled();
    expect(screen.getByText("Not configured")).toBeInTheDocument();
  });

  it("shows pending state and a validated live explanation", async () => {
    let resolveRequest!: (response: Response) => void;
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    render(
      <ProgressExplanationCard
        capability={createCapability(
          "zero-g",
          "available",
          "0G private compute",
          "Configured",
        )}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Explain my progress" }),
    );
    expect(
      screen.getByRole("button", { name: "Encrypting and verifying…" }),
    ).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "confirmations may take a minute",
    );

    resolveRequest(
      new Response(
        JSON.stringify({
          explanation: {
            disclaimer: PROGRESS_EXPLANATION_DISCLAIMER,
            possibleNextCourses: [],
            progressHighlights: ["CS 1301 is complete."],
            risks: ["CS 2305 is in progress."],
            summary: "You have completed 3 of 120 credits.",
          },
          mode: "available",
        }),
        { status: 200 },
      ),
    );

    await waitFor(() =>
      expect(
        screen.getByText("You have completed 3 of 120 credits."),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText("Encrypted input and output verified"),
    ).toBeInTheDocument();
  });
});
