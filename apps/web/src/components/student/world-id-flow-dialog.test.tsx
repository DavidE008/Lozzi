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
  identityCheck: vi.fn(() => ({ type: "IdentityCheck" })),
  open: vi.fn(),
  proofOfHuman: vi.fn(() => ({ type: "ProofOfHuman" })),
  reset: vi.fn(),
  selfieCheckLegacy: vi.fn(() => ({ type: "SelfieCheckLegacy" })),
  useIDKitRequest: vi.fn(() => flowMock.current),
}));

vi.mock("@worldcoin/idkit", () => ({
  identityCheck: flowMock.identityCheck,
  proofOfHuman: flowMock.proofOfHuman,
  selfieCheckLegacy: flowMock.selfieCheckLegacy,
  useIDKitRequest: flowMock.useIDKitRequest,
}));

const request: WorldIdFlowRequest = {
  action: "verify-student-account-2026",
  allowLegacyProofs: true,
  appId: "app_example",
  challengeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  environment: "staging",
  preset: { type: "proof-of-human" },
  purpose: "account-humanity",
  requireUserPresence: false,
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
    flowMock.identityCheck.mockClear();
    flowMock.open.mockReset();
    flowMock.proofOfHuman.mockClear();
    flowMock.reset.mockReset();
    flowMock.selfieCheckLegacy.mockClear();
    flowMock.useIDKitRequest.mockClear();
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
      screen.getByRole("img", { name: "World account verification QR code" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open World App" }),
    ).toHaveAttribute("href", flowMock.current.connectorURI);
    expect(flowMock.open).toHaveBeenCalledOnce();
    expect(flowMock.proofOfHuman).toHaveBeenCalledWith({
      signal: request.signal,
    });
  });

  it("uses the purpose-bound Selfie Check preset and presence requirement", () => {
    const selfieRequest: WorldIdFlowRequest = {
      ...request,
      action: "lozzi-sensitive-share-selfie-check",
      preset: { type: "selfie-check-legacy" },
      purpose: "share-liveness",
      requireUserPresence: true,
      subjectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    };

    render(
      <WorldIdFlowDialog
        open
        request={selfieRequest}
        onOpenChange={vi.fn()}
        onVerify={vi.fn()}
        onFlowError={vi.fn()}
      />,
    );

    expect(flowMock.selfieCheckLegacy).toHaveBeenCalledWith({
      signal: selfieRequest.signal,
    });
    expect(flowMock.useIDKitRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        allow_legacy_proofs: true,
        require_user_presence: true,
      }),
    );
    expect(
      screen.getByRole("img", { name: "World Selfie Check QR code" }),
    ).toBeInTheDocument();
  });

  it("requests only a minimum-age Identity Check attribute", () => {
    const identityRequest: WorldIdFlowRequest = {
      ...request,
      action: "lozzi-adult-share-consent",
      allowLegacyProofs: false,
      preset: {
        attributes: [{ type: "minimum_age", value: 18 }],
        type: "identity-check",
      },
      purpose: "adult-share-consent",
      requireUserPresence: true,
      subjectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    };

    render(
      <WorldIdFlowDialog
        open
        request={identityRequest}
        onOpenChange={vi.fn()}
        onVerify={vi.fn()}
        onFlowError={vi.fn()}
      />,
    );

    expect(flowMock.identityCheck).toHaveBeenCalledWith({
      attributes: [{ type: "minimum_age", value: 18 }],
      legacy_signal: identityRequest.signal,
    });
    expect(flowMock.useIDKitRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        allow_legacy_proofs: false,
        require_user_presence: true,
      }),
    );
    expect(
      screen.getByRole("img", { name: "World adult consent QR code" }),
    ).toBeInTheDocument();
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
