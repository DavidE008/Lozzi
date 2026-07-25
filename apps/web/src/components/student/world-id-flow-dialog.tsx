"use client";

import {
  proofOfHuman,
  type IDKitResult,
  type RpContext,
  useIDKitRequest,
} from "@worldcoin/idkit";
import { CheckCircle2, LoaderCircle, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface WorldIdFlowRequest {
  readonly action: string;
  readonly appId: `app_${string}`;
  readonly environment: "production" | "staging";
  readonly rpContext: RpContext;
  readonly signal: string;
}

interface WorldIdFlowDialogProps {
  readonly open: boolean;
  readonly request: WorldIdFlowRequest;
  readonly onOpenChange: (open: boolean) => void;
  readonly onVerify: (result: IDKitResult) => Promise<void>;
  readonly onFlowError: () => void;
}

type HostStatus = "idle" | "verifying" | "verified" | "failed";

export function WorldIdFlowDialog({
  open,
  request,
  onOpenChange,
  onVerify,
  onFlowError,
}: WorldIdFlowDialogProps) {
  const flow = useIDKitRequest({
    app_id: request.appId,
    action: request.action,
    rp_context: request.rpContext,
    environment: request.environment,
    allow_legacy_proofs: true,
    preset: proofOfHuman({ signal: request.signal }),
  });
  const [hostStatus, setHostStatus] = useState<HostStatus>("idle");
  const lastResult = useRef<IDKitResult | null>(null);
  const lastErrorCode = useRef(flow.errorCode);
  const openFlow = flow.open;
  const resetFlow = flow.reset;

  useEffect(() => {
    if (open) {
      openFlow();
      return;
    }
    resetFlow();
  }, [open, openFlow, resetFlow]);

  useEffect(() => {
    if (
      !open ||
      !flow.isSuccess ||
      !flow.result ||
      flow.result === lastResult.current
    ) {
      return;
    }

    lastResult.current = flow.result;
    setHostStatus("verifying");
    void onVerify(flow.result)
      .then(() => {
        setHostStatus("verified");
        onOpenChange(false);
      })
      .catch(() => {
        setHostStatus("failed");
      });
  }, [flow.isSuccess, flow.result, onOpenChange, onVerify, open]);

  useEffect(() => {
    if (
      !open ||
      !flow.isError ||
      !flow.errorCode ||
      flow.errorCode === lastErrorCode.current
    ) {
      return;
    }

    lastErrorCode.current = flow.errorCode;
    onFlowError();
  }, [flow.errorCode, flow.isError, onFlowError, open]);

  const close = () => {
    lastResult.current = null;
    lastErrorCode.current = null;
    setHostStatus("idle");
    onOpenChange(false);
  };

  if (flow.isInWorldApp) return null;

  const failed = flow.isError || hostStatus === "failed";
  const waitingForApproval = flow.isAwaitingUserConfirmation;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
      <DialogContent>
        <div className="pr-8">
          <DialogTitle>Connect your World ID</DialogTitle>
          <DialogDescription>
            Scan the code with World App. Lozzi receives a
            privacy-preserving proof, not your biometric data.
          </DialogDescription>
        </div>

        <div className="mt-6 flex min-h-56 flex-col items-center justify-center">
          {failed ? (
            <div className="border-destructive/20 bg-destructive/5 w-full border p-5 text-center">
              <p className="font-medium">Verification was not completed</p>
              <p className="text-muted-foreground mt-2 text-sm">
                Close this dialog and start a fresh request when you are ready.
              </p>
            </div>
          ) : hostStatus === "verifying" ? (
            <div
              role="status"
              className="flex flex-col items-center gap-3 text-center"
            >
              <LoaderCircle
                aria-hidden="true"
                className="text-lozzi-teal size-8 animate-spin"
              />
              <p className="font-medium">Lozzi is confirming the proof</p>
              <p className="text-muted-foreground max-w-xs text-sm">
                Keep this dialog open while the signed-in account binding and
                replay protection are checked.
              </p>
            </div>
          ) : hostStatus === "verified" ? (
            <div
              role="status"
              className="flex flex-col items-center gap-3 text-center"
            >
              <CheckCircle2
                aria-hidden="true"
                className="text-lozzi-teal size-9"
              />
              <p className="font-medium">Verification confirmed</p>
            </div>
          ) : flow.connectorURI ? (
            <>
              <div className="border-border bg-white border p-3">
                <QRCodeSVG
                  value={flow.connectorURI}
                  size={192}
                  bgColor="#FFFFFF"
                  fgColor="#0D1B2A"
                  level="M"
                  marginSize={1}
                  role="img"
                  aria-label="World verification QR code"
                />
              </div>
              <div role="status" className="mt-4 text-center">
                <p className="font-medium">
                  {waitingForApproval
                    ? "Approve the request in World App"
                    : "Scan with your phone to continue"}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  This code is time-limited and scoped to your Lozzi account.
                </p>
              </div>
              <a
                className={cn(buttonVariants(), "mt-4")}
                href={flow.connectorURI}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Smartphone aria-hidden="true" />
                Open World App
              </a>
            </>
          ) : (
            <div
              role="status"
              className="flex flex-col items-center gap-3 text-center"
            >
              <LoaderCircle
                aria-hidden="true"
                className="text-lozzi-teal size-8 animate-spin"
              />
              <p className="font-medium">Preparing a secure request</p>
              <p className="text-muted-foreground max-w-xs text-sm">
                Lozzi is creating an encrypted, account-bound connection.
              </p>
            </div>
          )}
        </div>

        <p className="text-muted-foreground mt-5 border-t pt-4 text-center text-xs">
          By continuing, you interact with World under its{" "}
          <a
            className="text-foreground underline underline-offset-2"
            href="https://developer.world.org/privacy-statement"
            target="_blank"
            rel="noopener noreferrer"
          >
            privacy statement
          </a>
          .
        </p>
      </DialogContent>
    </Dialog>
  );
}
