"use client";

import type { CapabilityState } from "@lozzi/domain";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock3,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";

import { EnsIdentityCard } from "@/components/student/ens-identity-card";
import { WorldVerificationCard } from "@/components/student/world-verification-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface IdentitySetupCardProps {
  readonly credentialType: string | null;
  readonly currentName: string | null;
  readonly currentStatus: string | null;
  readonly ensCapability: CapabilityState;
  readonly institutionName: string;
  readonly parentName: string | null;
  readonly verifiedAt: string | null;
  readonly walletAddress: `0x${string}` | null;
  readonly walletLinkAvailable: boolean;
  readonly worldCapability: CapabilityState;
  readonly worldVerified: boolean;
}

type EvidenceMode = "demo" | "live" | "none";
type StepTone =
  "attention" | "blocked" | "complete" | "demo" | "pending" | "ready";

interface IdentityStepProps {
  readonly detail: string;
  readonly label: string;
  readonly number: number;
  readonly tone: StepTone;
}

const stepIcon = {
  attention: AlertCircle,
  blocked: LockKeyhole,
  complete: CheckCircle2,
  demo: ShieldCheck,
  pending: Clock3,
  ready: Circle,
} as const;

const toneClasses: Record<StepTone, string> = {
  attention: "border-destructive/25 bg-destructive/5 text-destructive",
  blocked: "border-border bg-muted/40 text-muted-foreground",
  complete: "border-lozzi-teal/25 bg-lozzi-teal/5 text-lozzi-teal",
  demo: "border-amber-300/70 bg-amber-50 text-amber-800",
  pending: "border-blue-200 bg-blue-50 text-blue-800",
  ready: "border-lozzi-navy/15 bg-lozzi-navy/5 text-lozzi-navy",
};

function IdentityStep({ detail, label, number, tone }: IdentityStepProps) {
  const Icon = stepIcon[tone];
  return (
    <li className="flex min-w-0 items-start gap-3">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full border",
          toneClasses[tone],
        )}
      >
        <Icon aria-hidden="true" className="size-4" />
        <span className="sr-only">Step {number}</span>
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-medium">
          {number}. {label}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">{detail}</p>
      </div>
    </li>
  );
}

const pendingStatuses = new Set([
  "confirmed",
  "pending",
  "submitted",
  "submitting",
]);

export function IdentitySetupCard({
  credentialType,
  currentName,
  currentStatus,
  ensCapability,
  institutionName,
  parentName,
  verifiedAt,
  walletAddress: initialWalletAddress,
  walletLinkAvailable,
  worldCapability,
  worldVerified,
}: IdentitySetupCardProps) {
  const [worldEvidence, setWorldEvidence] = useState<EvidenceMode>(
    worldVerified ? "live" : "none",
  );
  const [walletAddress, setWalletAddress] = useState(initialWalletAddress);
  const [identityName, setIdentityName] = useState(currentName);
  const [identityStatus, setIdentityStatus] = useState(currentStatus);
  const liveWorldVerified = worldEvidence === "live";
  const localDemo =
    worldCapability.status === "mock-development" ||
    ensCapability.status === "mock-development";
  const identityPending = pendingStatuses.has(identityStatus ?? "");

  const personStep: IdentityStepProps =
    worldEvidence === "live"
      ? {
          detail: "Verified",
          label: "Verify person",
          number: 1,
          tone: "complete",
        }
      : worldEvidence === "demo"
        ? {
            detail: "Local demo only",
            label: "Verify person",
            number: 1,
            tone: "demo",
          }
        : worldCapability.status === "available" ||
            worldCapability.status === "mock-development"
          ? {
              detail: "Ready",
              label: "Verify person",
              number: 1,
              tone: "ready",
            }
          : {
              detail: "Not configured",
              label: "Verify person",
              number: 1,
              tone: "blocked",
            };

  const walletStep: IdentityStepProps = walletAddress
    ? {
        detail: "Ownership verified",
        label: "Verify wallet",
        number: 2,
        tone: "complete",
      }
    : worldEvidence === "demo"
      ? {
          detail: "Real proof required",
          label: "Verify wallet",
          number: 2,
          tone: "blocked",
        }
      : liveWorldVerified && walletLinkAvailable
        ? {
            detail: "Ready",
            label: "Verify wallet",
            number: 2,
            tone: "ready",
          }
        : {
            detail: liveWorldVerified ? "Not configured" : "Complete step 1",
            label: "Verify wallet",
            number: 2,
            tone: "blocked",
          };

  const reviewStep: IdentityStepProps = identityName
    ? {
        detail:
          identityStatus === "prepared-demo" ? "Prepared locally" : "Reviewed",
        label: "Review identity",
        number: 3,
        tone: identityStatus === "prepared-demo" ? "demo" : "complete",
      }
    : walletAddress
      ? {
          detail: "Ready",
          label: "Review identity",
          number: 3,
          tone: "ready",
        }
      : {
          detail: "Complete step 2",
          label: "Review identity",
          number: 3,
          tone: "blocked",
        };

  const issuanceStep: IdentityStepProps =
    identityStatus === "active"
      ? {
          detail: "Issued",
          label: "Institution confirms",
          number: 4,
          tone: "complete",
        }
      : identityStatus === "prepared-demo"
        ? {
            detail: "No live issuance",
            label: "Institution confirms",
            number: 4,
            tone: "demo",
          }
        : identityStatus === "failed"
          ? {
              detail: "Needs attention",
              label: "Institution confirms",
              number: 4,
              tone: "attention",
            }
          : identityPending || identityStatus === "revocation-pending"
            ? {
                detail:
                  identityStatus === "revocation-pending"
                    ? "Revocation pending"
                    : "Pending",
                label: "Institution confirms",
                number: 4,
                tone: "pending",
              }
            : {
                detail: "Not started",
                label: "Institution confirms",
                number: 4,
                tone: "blocked",
              };

  return (
    <Card className="overflow-hidden shadow-none lg:col-span-2">
      <CardHeader className="gap-3 border-b">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="bg-lozzi-navy text-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-sm">
              <Fingerprint aria-hidden="true" className="size-5" />
            </span>
            <div>
              <CardTitle className="font-heading text-2xl">
                Your Lozzi identity
              </CardTitle>
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
                World verifies the person. {institutionName} can then issue a
                readable identity to a wallet you control. Your academic record
                remains private and offchain.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit">
            World + ENS
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {localDemo ? (
          <div
            role="note"
            className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900"
          >
            Local demo mode is clearly isolated. A demo verification or prepared
            alias never becomes a live proof, wallet link, ENS name, or
            transaction.
          </div>
        ) : null}
        <ol className="grid gap-5 border-b px-6 py-5 sm:grid-cols-2 xl:grid-cols-4">
          {[personStep, walletStep, reviewStep, issuanceStep].map((step) => (
            <IdentityStep key={step.number} {...step} />
          ))}
        </ol>

        <WorldVerificationCard
          capability={worldCapability}
          credentialType={credentialType}
          embedded
          verifiedAt={verifiedAt}
          onVerificationChange={({ mode }) => setWorldEvidence(mode)}
        />
        <EnsIdentityCard
          capability={ensCapability}
          currentName={currentName}
          currentStatus={currentStatus}
          embedded
          onIdentityChange={({ name, status }) => {
            setIdentityName(name);
            setIdentityStatus(status);
          }}
          onWalletAddressChange={setWalletAddress}
          parentName={parentName}
          walletAddress={initialWalletAddress}
          walletLinkAvailable={walletLinkAvailable}
          worldVerified={liveWorldVerified}
        />

        <div className="bg-muted/35 border-t px-6 py-5">
          <p className="text-sm font-medium">What Lozzi keeps private</p>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-6">
            Raw World proofs are used only for verification and are not stored.
            Lozzi keeps the minimum account-bound verification metadata, a
            verified wallet link, and—only after consent—the neutral alias
            needed for issuance. Names, emails, student numbers, grades, and
            academic records are never written to ENS or public events.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
