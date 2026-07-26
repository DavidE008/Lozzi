import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShareHistoryList, type ShareHistoryRow } from "./share-history-list";

const activeShare: ShareHistoryRow = {
  chain_status: "local_private",
  expires_at: "2026-07-26T05:00:00.000Z",
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  recipient_label: "Graduate admissions office",
  revoked_at: null,
  scopes: ["record-summary"],
  status: "active",
};

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ShareHistoryList", () => {
  it("confirms revocation and immediately updates local access state", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        chainStatus: "local_private",
        idempotentReplay: false,
        reconciliationQueued: true,
        revokedAt: "2026-07-26T04:10:00+00:00",
        shareGrantId: activeShare.id,
        status: "revoked",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ShareHistoryList
        now="2026-07-26T04:00:00.000Z"
        shares={[activeShare]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Revoke access" }));
    expect(
      screen.getByRole("dialog", { name: "Revoke this share?" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Confirm revocation" }));

    expect(await screen.findByText("Revoked")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Access was revoked immediately.",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/student/shares/${activeShare.id}/revoke`,
      expect.objectContaining({
        headers: {
          "idempotency-key": expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f-]{27}$/u,
          ),
        },
        method: "POST",
      }),
    );
    expect(
      screen.queryByRole("button", { name: "Revoke access" }),
    ).not.toBeInTheDocument();
  });

  it("derives expiration without offering a revocation write", () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ShareHistoryList
        now="2026-07-26T05:00:01.000Z"
        shares={[activeShare]}
      />,
    );

    expect(screen.getByText("Expired")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Revoke access" }),
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps offchain access revoked while chain reconciliation is pending", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        chainStatus: "revocation_pending",
        idempotentReplay: false,
        reconciliationQueued: true,
        revokedAt: "2026-07-26T04:10:00+00:00",
        shareGrantId: activeShare.id,
        status: "revoked",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ShareHistoryList
        now="2026-07-26T04:00:00.000Z"
        shares={[{ ...activeShare, chain_status: "anchored" }]}
      />,
    );
    expect(screen.getByText(/reconciliation: chain-confirmed/i)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Revoke access" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm revocation" }));

    expect(
      await screen.findByText(/reconciliation: chain revocation pending/i),
    ).toBeVisible();
    expect(screen.getByText("Revoked")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Chain reconciliation is pending.",
    );
  });
});
