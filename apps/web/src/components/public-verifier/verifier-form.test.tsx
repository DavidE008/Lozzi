import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { tokenFromFragment, VerifierForm } from "./verifier-form";

const localResult = {
  disclosure: {
    "record-summary": {
      courseCount: 2,
      creditsEarned: 6,
      latestPublishedAt: "2026-07-26T12:00:00.000Z",
    },
  },
  expiresAt: "2026-07-26T12:30:00.000Z",
  issuer: { name: "Northstar University" },
  record: {
    anchorStatus: "not_configured",
    commitment: `0x${"ab".repeat(32)}`,
    publishedAt: "2026-07-26T12:00:00.000Z",
    versionNumber: 2,
  },
  scopes: ["record-summary"],
  status: "locally_verified",
};

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});

describe("VerifierForm", () => {
  it("submits a pasted token only in the JSON body and clears the input", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response(localResult));
    vi.stubGlobal("fetch", fetchMock);
    render(<VerifierForm />);

    fireEvent.change(screen.getByLabelText("Share token"), {
      target: { value: "synthetic_private_token_123456" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Verify private share" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Northstar University" }),
    ).toBeVisible();
    expect(screen.getByText("Locally verified disclosure")).toBeVisible();
    expect(screen.getByLabelText("Share token")).toHaveValue("");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/verify",
      expect.objectContaining({
        body: JSON.stringify({
          token: "synthetic_private_token_123456",
        }),
        method: "POST",
      }),
    );
    expect(window.location.search).toBe("");
  });

  it("removes a fragment token before verification and never renders it", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({ status: "invalid" }));
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(
      null,
      "",
      "/verify#token=synthetic_fragment_token_123456",
    );

    render(<VerifierForm />);

    expect(
      await screen.findByRole("heading", { name: "Share not found" }),
    ).toBeVisible();
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/verify");
    expect(document.body).not.toHaveTextContent(
      "synthetic_fragment_token_123456",
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  });

  it("shows revoked and expired states without disclosure fields", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({
          expiresAt: "2026-07-26T12:30:00.000Z",
          issuer: { name: "Northstar University" },
          status: "revoked",
        }),
      )
      .mockResolvedValueOnce(
        response({
          expiresAt: "2026-07-26T12:30:00.000Z",
          issuer: { name: "Northstar University" },
          status: "expired",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const first = render(<VerifierForm />);

    fireEvent.change(screen.getByLabelText("Share token"), {
      target: { value: "synthetic_revoked_token_123456" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Verify private share" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Share revoked" }),
    ).toBeVisible();
    expect(screen.queryByText("Record summary")).not.toBeInTheDocument();

    first.unmount();
    render(<VerifierForm />);
    fireEvent.change(screen.getByLabelText("Share token"), {
      target: { value: "synthetic_expired_token_123456" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Verify private share" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Share expired" }),
    ).toBeVisible();
    expect(screen.queryByText("Record summary")).not.toBeInTheDocument();
  });

  it("removes and rejects query-string tokens without verification", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(
      null,
      "",
      "/verify?token=synthetic_query_token_123456",
    );

    render(<VerifierForm />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /query-string tokens are not accepted/i,
    );
    expect(window.location.search).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.body).not.toHaveTextContent("synthetic_query_token_123456");
  });
});

describe("tokenFromFragment", () => {
  it("accepts only the named token fragment field", () => {
    expect(tokenFromFragment("#token=synthetic_token_1234567890")).toBe(
      "synthetic_token_1234567890",
    );
    expect(tokenFromFragment("?token=synthetic_token_1234567890")).toBeNull();
    expect(tokenFromFragment("#other=synthetic_token_1234567890")).toBeNull();
  });
});
