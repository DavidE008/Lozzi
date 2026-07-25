import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EnsIdentityCard } from "./ens-identity-card";

describe("EnsIdentityCard", () => {
  it("requires both provider configuration and a verified wallet", () => {
    render(
      <EnsIdentityCard
        capability={{
          name: "ens",
          status: "available",
          label: "ENS subnames",
          detail: "Configured",
        }}
        currentName={null}
        currentStatus={null}
        parentName="lozzi-sepolia.eth"
        walletAddress={null}
      />,
    );

    expect(screen.getByText("Wallet required")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Connect and verify wallet" }),
    ).toBeEnabled();
    expect(
      screen.getByText(/never written to ENS text records/u),
    ).toBeInTheDocument();
  });

  it("renders the resolved public pseudonym", () => {
    render(
      <EnsIdentityCard
        capability={{
          name: "ens",
          status: "available",
          label: "ENS subnames",
          detail: "Configured",
        }}
        currentName="aisha.lozzi-sepolia.eth"
        currentStatus="active"
        parentName="lozzi-sepolia.eth"
        walletAddress={`0x${"11".repeat(20)}`}
      />,
    );

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("aisha.lozzi-sepolia.eth")).toBeInTheDocument();
    expect(
      screen.getByText(/Resolves to your verified Sepolia wallet/u),
    ).toBeInTheDocument();
  });
});
