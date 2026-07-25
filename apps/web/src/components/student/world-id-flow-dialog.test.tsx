import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  WorldIdFlowDialog,
  type WorldIdFlowRequest,
} from "./world-id-flow-dialog";

interface MockFlowState {
  readonly connectorURI: string | null;
  readonly errorCode: string | null;
  readonly isAwaitingUserConfirmation: boolean;
  readonly isError: boolean;
  readonly isInWorldApp: boolean;
  readonly isSuccess: boolean;
  readonly open: () => void;
  readonly reset: () => void;
  readonly result: Record<string, unknown> | null;
}

const flowMock = vi.hoisted(() => ({
  current: null as unknown as MockFlowState,
  open: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("@worldcoin/idkit", () => ({
  proofOfHuman: vi.fn(() => ({ type: "ProofOfHuman" })),
  useIDKitRequest: vi.fn(() => flowMock.current),
}));

const request: WorldIdFlowRequest = {
  action: "verify-student-account-2026",
  appId: "app_example",
  environment: "staging",
  rpContext: {
    rp_id: "rp_example",
    nonce: "0x01",
    created_at: 1,
    expires_at: 2,
    signature: "0x02",
  },
  signal: "lozzi:world:account",
};

const baseFlow = (): MockFlowState => ({
  connectorURI: "https://world.org/verify?t=wld&i=request",
  errorCode: null,
  isAwaitingUserConfirmation: false,
  isError: false,
  isInWorldApp: false,
  isSuccess: false,
  open: flowMock.open,
  reset: flowMock.reset,
  result: null,
});

describe("WorldIdFlowDialog", () => {
  beforeEach(() => {
    flowMock.current = baseFlow();
    flowMock.open.mockReset();
    flowMock.reset.mockReset();
  });

  it("renders a local QR handoff without loading remote widget assets", () => {
    render(
      <WorldIdFlowDialog
        open
        request={request}
        onOpenChange={vi.fn()}
        onVerify={vi.fn()}
        onFlowError={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("img", { name: "World verification QR code" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open World App" }),
    ).toHaveAttribute("href", flowMock.current.connectorURI);
    expect(flowMock.open).toHaveBeenCalledOnce();
  });

  it("surfaces a provider flow failure", async () => {
    flowMock.current = {
      ...baseFlow(),
      connectorURI: null,
      errorCode: "connection_failed",
      isError: true,
    };
    const onFlowError = vi.fn();

    render(
      <WorldIdFlowDialog
        open
        request={request}
        onOpenChange={vi.fn()}
        onVerify={vi.fn()}
        onFlowError={onFlowError}
      />,
    );

    expect(
      screen.getByText("Verification was not completed"),
    ).toBeInTheDocument();
    await waitFor(() => expect(onFlowError).toHaveBeenCalledOnce());
  });

  it("verifies the exact SDK result before closing", async () => {
    const result = {
      action: request.action,
      environment: request.environment,
      nonce: request.rpContext.nonce,
      protocol_version: "4.0",
      responses: [],
      user_presence_completed: true,
    };
    flowMock.current = {
      ...baseFlow(),
      connectorURI: null,
      isSuccess: true,
      result,
    };
    const onVerify = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <WorldIdFlowDialog
        open
        request={request}
        onOpenChange={onOpenChange}
        onVerify={onVerify}
        onFlowError={vi.fn()}
      />,
    );

    await waitFor(() => expect(onVerify).toHaveBeenCalledWith(result));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
