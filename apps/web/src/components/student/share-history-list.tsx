"use client";

import type {
  SensitiveShareChainStatus,
  SensitiveShareRevocationResult,
  ShareDisclosureScope,
} from "@lozzi/domain";
import { Clock3, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ShareHistoryRow {
  readonly chain_status: SensitiveShareChainStatus;
  readonly expires_at: string;
  readonly id: string;
  readonly recipient_label: string;
  readonly revoked_at: string | null;
  readonly scopes: ShareDisclosureScope[];
  readonly status: string;
}

interface ShareHistoryListProps {
  readonly now: string;
  readonly shares: ShareHistoryRow[];
}

const chainLabel: Readonly<Record<SensitiveShareChainStatus, string>> = {
  anchor_failed: "Anchor unavailable",
  anchored: "Chain-confirmed",
  anchoring_pending: "Anchor pending",
  local_private: "Local/private",
  revoked: "Chain revocation reconciled",
  revocation_pending: "Chain revocation pending",
};

const readJson = async (
  response: Response,
): Promise<SensitiveShareRevocationResult> => {
  const payload = (await response.json()) as SensitiveShareRevocationResult & {
    readonly error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error ?? "The share could not be revoked.");
  }
  return payload;
};

const lifecycle = (share: ShareHistoryRow, now: Date) => {
  if (share.status === "revoked" || share.revoked_at) return "revoked";
  if (share.status === "expired" || new Date(share.expires_at) <= now) {
    return "expired";
  }
  return "active";
};

export function ShareHistoryList({ now, shares }: ShareHistoryListProps) {
  const [rows, setRows] = useState(shares);
  const [currentTime, setCurrentTime] = useState(() => new Date(now));
  const [selected, setSelected] = useState<ShareHistoryRow | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKeys = useRef(new Map<string, string>());

  useEffect(() => {
    const interval = window.setInterval(
      () => setCurrentTime(new Date()),
      30_000,
    );
    return () => window.clearInterval(interval);
  }, []);

  const revoke = async () => {
    if (!selected) return;
    setPending(true);
    setError(null);
    setNotice(null);
    let idempotencyKey = idempotencyKeys.current.get(selected.id);
    if (!idempotencyKey) {
      idempotencyKey = crypto.randomUUID();
      idempotencyKeys.current.set(selected.id, idempotencyKey);
    }

    try {
      const result = await readJson(
        await fetch(
          `/api/student/shares/${encodeURIComponent(selected.id)}/revoke`,
          {
            headers: { "idempotency-key": idempotencyKey },
            method: "POST",
          },
        ),
      );
      if (result.status === "expired") {
        setRows((current) =>
          current.map((share) =>
            share.id === selected.id ? { ...share, status: "expired" } : share,
          ),
        );
        setNotice("This share had already expired. Access remains closed.");
      } else {
        setRows((current) =>
          current.map((share) =>
            share.id === selected.id
              ? {
                  ...share,
                  chain_status: result.chainStatus,
                  revoked_at: result.revokedAt,
                  status: "revoked",
                }
              : share,
          ),
        );
        setNotice(
          result.chainStatus === "revocation_pending"
            ? "Access was revoked immediately. Chain reconciliation is pending."
            : "Access was revoked immediately.",
        );
      }
      setSelected(null);
    } catch {
      setError("The share could not be revoked. Access state was not changed.");
    } finally {
      setPending(false);
    }
  };

  if (!rows.length) {
    return (
      <Card className="shadow-none">
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          You have not created any record shares.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {notice ? (
        <p
          role="status"
          className="border-lozzi-teal/25 bg-lozzi-teal/5 text-lozzi-teal rounded-lg border px-4 py-3 text-sm"
        >
          {notice}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="border-destructive/25 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm"
        >
          {error}
        </p>
      ) : null}
      {rows.map((share) => {
        const state = lifecycle(share, currentTime);
        return (
          <Card key={share.id} className="shadow-none">
            <CardContent className="flex flex-col gap-4 py-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4">
                <span className="bg-lozzi-teal/10 text-lozzi-teal flex size-10 shrink-0 items-center justify-center rounded-sm">
                  <ShieldCheck className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-medium">{share.recipient_label}</h2>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Scope: {share.scopes.join(", ")}
                  </p>
                  <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
                    <Clock3 className="size-3" aria-hidden="true" />
                    Expires{" "}
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(share.expires_at))}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Reconciliation: {chainLabel[share.chain_status]}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    state === "active"
                      ? "border-lozzi-teal/30 bg-lozzi-teal/5 text-lozzi-teal"
                      : "border-muted-foreground/20 text-muted-foreground"
                  }
                >
                  {state === "active"
                    ? "Active"
                    : state === "revoked"
                      ? "Revoked"
                      : "Expired"}
                </Badge>
                {state === "active" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setError(null);
                      setNotice(null);
                      setSelected(share);
                    }}
                  >
                    Revoke access
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open && !pending) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Revoke this share?</DialogTitle>
          <DialogDescription>
            Access stops immediately. Any required chain reconciliation happens
            asynchronously and cannot re-enable offchain access.
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setSelected(null)}
            >
              Keep active
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => void revoke()}
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              Confirm revocation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
