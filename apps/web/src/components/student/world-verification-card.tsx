"use client";

import type { IDKitResult } from "@worldcoin/idkit";
import type { CapabilityState } from "@lozzi/domain";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";

import {
  WorldIdFlowDialog,
  type WorldIdFlowRequest,
} from "@/components/student/world-id-flow-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface WorldVerificationCardProps {
  readonly capability: CapabilityState;
  readonly credentialType: string | null;
  readonly embedded?: boolean;
  readonly onVerificationChange?: (input: {
    readonly mode: "demo" | "live";
    readonly verifiedAt: string;
  }) => void;
  readonly verifiedAt: string | null;
}

const statusLabel = (
  capability: CapabilityState,
  verifiedAt: string | null,
) => {
  if (capability.status === "mock-development") return "Development mock";
  if (verifiedAt) return "Verified";
  if (capability.status === "failed") return "Unavailable";
  if (capability.status === "available") return "Ready";
  return "Not configured";
};

export function WorldVerificationCard({
  capability,
  credentialType,
  embedded = false,
  onVerificationChange,
  verifiedAt,
}: WorldVerificationCardProps) {
  const [request, setRequest] = useState<WorldIdFlowRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [successAt, setSuccessAt] = useState<string | null>(verifiedAt);
  const [mockUsed, setMockUsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const available = capability.status === "available";
  const mockDevelopment = capability.status === "mock-development";

  const beginVerification = async () => {
    setPending(true);
    setError(null);
    if (mockDevelopment) {
      const completedAt = new Date().toISOString();
      setMockUsed(true);
      setSuccessAt(completedAt);
      onVerificationChange?.({
        mode: "demo",
        verifiedAt: completedAt,
      });
      setPending(false);
      return;
    }
    try {
      const response = await fetch("/api/integrations/world/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose: "account-humanity" }),
      });
      if (!response.ok) throw new Error("World verification is unavailable.");
      const payload = (await response.json()) as WorldIdFlowRequest;
      setRequest(payload);
      setOpen(true);
    } catch {
      setError("World verification could not be started.");
    } finally {
      setPending(false);
    }
  };

  const verify = async (result: IDKitResult) => {
    setPending(true);
    setError(null);
    try {
      if (!request) throw new Error("World challenge is missing.");
      const response = await fetch(
        `/api/integrations/world/verify?challengeId=${encodeURIComponent(request.challengeId)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(result),
        },
      );
      const payload = (await response.json()) as {
        readonly error?: string;
        readonly verifiedAt?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "World verification failed.");
      }
      const completedAt = payload.verifiedAt ?? new Date().toISOString();
      setSuccessAt(completedAt);
      onVerificationChange?.({
        mode: "live",
        verifiedAt: completedAt,
      });
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "World verification failed.",
      );
      throw verificationError;
    } finally {
      setPending(false);
    }
  };

  return (
    <Card
      className={cn(
        "shadow-none lg:col-span-2",
        embedded && "rounded-none border-0 border-b shadow-none",
      )}
    >
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="bg-lozzi-navy/5 text-lozzi-navy flex size-10 shrink-0 items-center justify-center rounded-sm">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </span>
          <div>
            <CardTitle className="font-heading text-xl">
              Verify person
            </CardTitle>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
              World confirms the configured personhood claim for this account.
              It does not prove enrollment, academic standing, legal identity,
              or institutional affiliation. Raw proof material is not kept;
              Lozzi stores only the scoped nullifier and verification time.
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={
            successAt
              ? "border-lozzi-teal/30 text-lozzi-teal"
              : "text-muted-foreground"
          }
        >
          {statusLabel(capability, successAt)}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="border-border flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            {successAt ? (
              <>
                <p className="font-medium">
                  {mockUsed
                    ? "Development mock completed"
                    : "Verification is active"}
                </p>
                {mockUsed ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    No World proof or provider call was made.
                  </p>
                ) : (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {credentialType === "proof_of_human"
                      ? "Proof of Human"
                      : "Legacy Orb proof"}{" "}
                    · {new Date(successAt).toLocaleDateString("en-GB")}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="font-medium">{capability.detail}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  A World wallet is not linked to your academic record.
                </p>
              </>
            )}
          </div>
          <Button
            type="button"
            disabled={
              (!available && !mockDevelopment) || pending || Boolean(successAt)
            }
            onClick={beginVerification}
            className="sm:min-w-40"
          >
            {pending ? (
              <>
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
                Verifying…
              </>
            ) : successAt ? (
              mockUsed ? (
                "Mock complete"
              ) : (
                "Verified"
              )
            ) : mockDevelopment ? (
              "Run mock verification"
            ) : (
              "Verify with World"
            )}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-destructive mt-3 text-sm">
            {error}
          </p>
        ) : null}
      </CardContent>
      {request ? (
        <WorldIdFlowDialog
          open={open}
          request={request}
          onOpenChange={setOpen}
          onVerify={verify}
          onFlowError={() => {
            setPending(false);
            setError("World verification was not completed.");
          }}
        />
      ) : null}
    </Card>
  );
}
