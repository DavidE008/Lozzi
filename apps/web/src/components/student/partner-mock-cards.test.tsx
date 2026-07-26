import { createCapability } from "@lozzi/domain";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EnsIdentityCard } from "./ens-identity-card";
import { WorldVerificationCard } from "./world-verification-card";

const mockCapability = (name: "ens" | "world", label: string) =>
  createCapability(
    name,
    "mock-development",
    label,
    "Development mock — no live partner call.",
  );

describe("development-only partner mock cards", () => {
  afterEach(cleanup);

  it("labels a World mock without opening IDKit or claiming verification", () => {
    render(
      <WorldVerificationCard
        capability={mockCapability("world", "World verification")}
        credentialType={null}
        verifiedAt={null}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Run mock verification" }),
    );
    expect(screen.getByText("Development mock completed")).toBeInTheDocument();
    expect(
      screen.getByText("No World proof or provider call was made."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mock complete" }),
    ).toBeDisabled();
  });

  it("prepares a clearly local alias preview after consent", () => {
    render(
      <EnsIdentityCard
        capability={mockCapability("ens", "ENS subnames")}
        currentName={null}
        currentStatus={null}
        parentName={null}
        walletAddress={`0x${"11".repeat(20)}`}
        walletLinkAvailable
        worldVerified
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate alias" }));
    const generatedAlias = (
      screen.getByLabelText("Generated institutional alias") as HTMLInputElement
    ).value;
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(
      screen.getByRole("button", { name: "Prepare demo request" }),
    );

    expect(
      screen.getByText(`${generatedAlias}.northstar.lozzi.test`),
    ).toBeInTheDocument();
    expect(screen.getByText("Prepared locally")).toBeInTheDocument();
    expect(
      screen.getByText(/No ENS name, transaction, or wallet resolution/u),
    ).toBeInTheDocument();
  });
});
