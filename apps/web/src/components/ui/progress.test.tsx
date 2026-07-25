import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Progress } from "./progress";

describe("Progress", () => {
  it("keeps Base UI's presentational shim visually hidden", () => {
    const { container } = render(<Progress value={3} />);

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "3");
    expect(progressbar).toHaveClass("[&>span[role=presentation]]:hidden");
    expect(
      container.querySelector('span[role="presentation"]'),
    ).toBeInTheDocument();
  });
});
