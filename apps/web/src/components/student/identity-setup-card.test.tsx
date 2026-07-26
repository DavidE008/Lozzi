import { createCapability } from "@lozzi/domain";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IdentitySetupCard } from "./identity-setup-card";

vi.mock("@worldcoin/idkit", () => ({
  IDKitRequestWidget: () => null,
  identityCheck: () => ({ kind: "identity-check" }),
  proofOfHuman: () => ({ kind: "proof-of-human" }),
  selfieCheckLegacy: () => ({ kind: "selfie-check" }),
  useIDKitRequest: () => ({
    connectorURI: null,
    errorCode: null,
    isAwaitingUserConfirmation: false,
    isError: false,
    isInWorldApp: false,
    isSuccess: false,
    open: vi.fn(),
    reset: vi.fn(),
    result: null,
  }),
}));

const capability = (
  name: "ens" | "world",
  status: "available" | "mock-development" | "not-configured",
) =>
  createCapability(
    name,
    status,
    name === "world" ? "World verification" : "ENS subnames",
    status === "available"
      ? "Configured"
      : status === "mock-development"
        ? "Development mock — no live partner call."
        : "Configuration required.",
  );

describe("IdentitySetupCard", () => {
  afterEach(cleanup);

  it("presents one fail-closed identity journey", () => {
    render(
      <IdentitySetupCard
        credentialType={null}
        currentName={null}
        currentStatus={null}
        ensCapability={capability("ens", "not-configured")}
        institutionName="Northstar University"
        parentName={null}
        verifiedAt={null}
        walletAddress={null}
        walletLinkAvailable={false}
        worldCapability={capability("world", "not-configured")}
        worldVerified={false}
      />,
    );

    expect(screen.getByText("Your Lozzi identity")).toBeInTheDocument();
    expect(screen.getByText("1. Verify person")).toBeInTheDocument();
    expect(screen.getByText("2. Verify wallet")).toBeInTheDocument();
    expect(screen.getByText("3. Review identity")).toBeInTheDocument();
    expect(screen.getByText("4. Institution confirms")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Verify with World" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Connect and verify wallet" }),
    ).toBeDisabled();
    expect(screen.queryByText(/0G/u)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Raw World proofs are used only for verification/u),
    ).toBeInTheDocument();
  });

  it("shows the unified issued identity state", () => {
    render(
      <IdentitySetupCard
        credentialType="proof_of_human"
        currentName="calm-river-42.lozzi-sepolia.eth"
        currentStatus="active"
        ensCapability={capability("ens", "available")}
        institutionName="Northstar University"
        parentName="lozzi-sepolia.eth"
        verifiedAt="2026-07-25T10:00:00.000Z"
        walletAddress={`0x${"11".repeat(20)}`}
        walletLinkAvailable
        worldCapability={capability("world", "available")}
        worldVerified
      />,
    );

    expect(screen.getByText("Ownership verified")).toBeInTheDocument();
    expect(screen.getByText("Issued")).toBeInTheDocument();
    expect(
      screen.getByText("calm-river-42.lozzi-sepolia.eth"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Issued by your institution/u)).toBeInTheDocument();
  });

  it("keeps a local World demo separate from the real wallet gate", () => {
    render(
      <IdentitySetupCard
        credentialType={null}
        currentName={null}
        currentStatus={null}
        ensCapability={capability("ens", "mock-development")}
        institutionName="Northstar University"
        parentName={null}
        verifiedAt={null}
        walletAddress={null}
        walletLinkAvailable
        worldCapability={capability("world", "mock-development")}
        worldVerified={false}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Run mock verification" }),
    );

    expect(screen.getByText("Local demo only")).toBeInTheDocument();
    expect(screen.getByText("Real proof required")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Connect and verify wallet" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/never becomes a live proof, wallet link, ENS name/u),
    ).toBeInTheDocument();
  });
});
