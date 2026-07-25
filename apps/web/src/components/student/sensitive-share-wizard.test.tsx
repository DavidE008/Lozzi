import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SensitiveShareWizard } from "./sensitive-share-wizard";

interface MockDialogProps {
  readonly onFlowError: () => void;
  readonly onVerify: (result: Record<string, unknown>) => Promise<void>;
  readonly open: boolean;
  readonly request: { readonly purpose: string };
}

vi.mock("@/components/student/world-id-flow-dialog", () => ({
  WorldIdFlowDialog: ({
    onFlowError,
    onVerify,
    open,
    request,
  }: MockDialogProps) =>
    open ? (
      <div role="dialog" aria-label={`${request.purpose} dialog`}>
        <button type="button" onClick={() => void onVerify({ proof: "exact" })}>
          Complete {request.purpose}
        </button>
        <button type="button" onClick={onFlowError}>
          Fail {request.purpose}
        </button>
      </div>
    ) : null,
}));

const available = {
  name: "world" as const,
  status: "available" as const,
  label: "World verification",
  detail: "World is configured.",
};

const worldRequest = (purpose: "adult-share-consent" | "share-liveness") => ({
  action:
    purpose === "adult-share-consent"
      ? "lozzi-adult-share-consent"
      : "lozzi-sensitive-share-selfie-check",
  allowLegacyProofs: purpose === "share-liveness",
  appId: "app_example",
  challengeId:
    purpose === "adult-share-consent"
      ? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      : "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  environment: "staging",
  preset:
    purpose === "adult-share-consent"
      ? {
          attributes: [{ type: "minimum_age", value: 18 }],
          type: "identity-check",
        }
      : { type: "selfie-check-legacy" },
  purpose,
  requireUserPresence: true,
  rpContext: {
    rp_id: "rp_example",
    nonce: "0x01",
    created_at: 1,
    expires_at: 2,
    signature: "0x02",
  },
  signal: "lozzi:world:signal",
  subjectId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
});

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });

const submitRecipient = () => {
  fireEvent.change(screen.getByLabelText("Recipient or purpose"), {
    target: { value: "Graduate admissions office" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Create protected share" }),
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SensitiveShareWizard", () => {
  it("requires age attestation and Selfie Check before returning a token", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({
          draftExpiresAt: "2026-07-25T18:30:00.000Z",
          draftId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          grantExpiresAt: "2026-07-25T18:30:00.000Z",
        }),
      )
      .mockResolvedValueOnce(response(worldRequest("adult-share-consent")))
      .mockResolvedValueOnce(response({ verifiedAt: "2026-07-25T18:01:00Z" }))
      .mockResolvedValueOnce(response(worldRequest("share-liveness")))
      .mockResolvedValueOnce(response({ verifiedAt: "2026-07-25T18:02:00Z" }))
      .mockResolvedValueOnce(
        response({
          expiresAt: "2026-07-25T18:30:00.000Z",
          shareGrantId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          shareToken: "one-time-synthetic-token",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<SensitiveShareWizard worldCapability={available} />);
    submitRecipient();

    expect(
      await screen.findByRole("heading", {
        name: "Confirm adult self-consent",
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with World" }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Complete adult-share-consent",
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Complete a fresh presence check",
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start Selfie Check" }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Complete share-liveness",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Share activated" }),
    ).toBeInTheDocument();
    expect(screen.getByText("one-time-synthetic-token")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ proof: "exact" }),
      }),
    );
  });

  it("routes an unavailable private attestation to registrar assistance", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({
          draftExpiresAt: "2026-07-25T18:30:00.000Z",
          draftId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          grantExpiresAt: "2026-07-25T18:30:00.000Z",
        }),
      )
      .mockResolvedValueOnce(
        response({
          draftId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          status: "assisted_consent_required",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SensitiveShareWizard
        worldCapability={{
          ...available,
          status: "not-configured",
          detail: "World credentials are required.",
        }}
      />,
    );
    expect(screen.getByText("World not configured")).toBeInTheDocument();
    submitRecipient();

    expect(
      await screen.findByRole("heading", {
        name: "Registrar review requested",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/without receiving an age result/u)).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not create a draft when the recipient label is empty", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    render(<SensitiveShareWizard worldCapability={available} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Create protected share" }),
    );

    expect(
      await screen.findByRole("alert", {
        name: "",
      }),
    ).toHaveTextContent("Enter a recipient label");
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });
});
