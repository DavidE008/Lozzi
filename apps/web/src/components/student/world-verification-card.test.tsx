import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorldVerificationCard } from "./world-verification-card";

vi.mock("@worldcoin/idkit", () => ({
  IDKitRequestWidget: () => null,
  proofOfHuman: () => ({ kind: "proof-of-human" }),
}));

describe("WorldVerificationCard", () => {
  it("shows an honest disabled state when credentials are missing", () => {
    render(
      <WorldVerificationCard
        capability={{
          name: "world",
          status: "not-configured",
          label: "World verification",
          detail: "World credentials are required.",
        }}
        credentialType={null}
        verifiedAt={null}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Verify with World" }),
    ).toBeDisabled();
    expect(screen.getByText("Not configured")).toBeInTheDocument();
    expect(
      screen.getByText(/stores only the scoped nullifier/u),
    ).toBeInTheDocument();
  });

  it("renders a completed proof without exposing an identifier", () => {
    render(
      <WorldVerificationCard
        capability={{
          name: "world",
          status: "available",
          label: "World verification",
          detail: "Configured",
        }}
        credentialType="proof_of_human"
        verifiedAt="2026-07-25T10:00:00.000Z"
      />,
    );

    expect(screen.getByText("Verification is active")).toBeInTheDocument();
    expect(screen.getByText("Proof of Human · 25/07/2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verified" })).toBeDisabled();
  });
});
