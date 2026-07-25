import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DegreePlanAgentCard } from "./degree-plan-agent-card";

const available = {
  name: "world-agentkit" as const,
  status: "available" as const,
  label: "World AgentKit",
  detail: "Configured",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DegreePlanAgentCard", () => {
  it("returns a one-time minimized delegation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            delegationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            delegationToken: "synthetic-one-time-token",
            expiresAt: "2026-07-25T19:00:00.000Z",
            scopes: ["degree-plan:read", "degree-plan:propose"],
          }),
          { headers: { "content-type": "application/json" }, status: 200 },
        ),
      ),
    );

    render(<DegreePlanAgentCard capability={available} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Create 30-minute delegation" }),
    );

    expect(await screen.findByText("Delegation ready")).toBeInTheDocument();
    expect(screen.getByText("synthetic-one-time-token")).toBeInTheDocument();
    expect(screen.getByText(/never your name, email, grades/u)).toBeVisible();
  });

  it("does not run a mock when AgentKit is not configured", () => {
    render(
      <DegreePlanAgentCard
        capability={{
          ...available,
          status: "not-configured",
          detail: "World Chain RPC and HMAC key are required.",
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Create 30-minute delegation" }),
    ).toBeDisabled();
    expect(screen.getByText("Not configured")).toBeInTheDocument();
  });
});
