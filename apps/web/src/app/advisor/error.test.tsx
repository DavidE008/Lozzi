import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AdvisorError from "./error";

describe("AdvisorError", () => {
  it("renders a non-destructive recovery state", () => {
    const reset = vi.fn();

    render(
      <AdvisorError error={new Error("synthetic failure")} reset={reset} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The review queue could not be loaded",
    );
    expect(
      screen.getByText(/No proposal or official record was changed/),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
