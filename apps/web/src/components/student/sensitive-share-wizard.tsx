"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { IDKitResult } from "@worldcoin/idkit";
import {
  sensitiveShareDraftInputSchema,
  type CapabilityState,
  type SensitiveShareDraftInput,
  type ShareDisclosureScope,
} from "@lozzi/domain";
import {
  Check,
  CheckCircle2,
  Clipboard,
  LoaderCircle,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  WorldIdFlowDialog,
  type WorldIdFlowRequest,
} from "@/components/student/world-id-flow-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

interface SensitiveShareWizardProps {
  readonly worldCapability: CapabilityState;
}

type FormValues = SensitiveShareDraftInput;
type Phase =
  | "details"
  | "adult-consent"
  | "selfie-check"
  | "activating"
  | "active"
  | "assisted"
  | "failed";

interface Draft {
  readonly draftExpiresAt: string;
  readonly draftId: string;
  readonly grantExpiresAt: string;
}

interface Activation {
  readonly chainStatus: "local_private";
  readonly expiresAt: string;
  readonly shareGrantId: string;
  readonly shareToken: string;
}

const scopeOptions: ReadonlyArray<{
  readonly description: string;
  readonly label: string;
  readonly value: ShareDisclosureScope;
}> = [
  {
    description: "Your institution and enrolled programme.",
    label: "Programme",
    value: "program",
  },
  {
    description: "Credits earned and progress toward completion.",
    label: "Degree progress",
    value: "degree-progress",
  },
  {
    description: "A summary of the current academic record version.",
    label: "Record summary",
    value: "record-summary",
  },
  {
    description: "Course and grade history in the current record version.",
    label: "Full record",
    value: "full-record",
  },
];

const progressByPhase: Readonly<Record<Phase, number>> = {
  details: 0,
  "adult-consent": 33,
  "selfie-check": 66,
  activating: 88,
  active: 100,
  assisted: 100,
  failed: 0,
};

const readJson = async <Output,>(response: Response): Promise<Output> => {
  const payload = (await response.json()) as Output & {
    readonly error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error ?? "The request could not be completed.");
  }
  return payload;
};

export function SensitiveShareWizard({
  worldCapability,
}: SensitiveShareWizardProps) {
  const [phase, setPhase] = useState<Phase>("details");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [activation, setActivation] = useState<Activation | null>(null);
  const [worldRequest, setWorldRequest] = useState<WorldIdFlowRequest | null>(
    null,
  );
  const [worldOpen, setWorldOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const worldAvailable = worldCapability.status === "available";
  const form = useForm<FormValues>({
    defaultValues: {
      expiryMinutes: 30,
      recipientLabel: "",
      scopes: [],
    },
    resolver: zodResolver(sensitiveShareDraftInputSchema),
  });

  const requestAssistance = async (draftId = draft?.draftId) => {
    if (!draftId) return;
    setPending(true);
    setError(null);
    try {
      await readJson(
        await fetch(
          `/api/student/shares/drafts/${encodeURIComponent(draftId)}/assisted-consent`,
          { method: "POST" },
        ),
      );
      setPhase("assisted");
      setWorldOpen(false);
      setWorldRequest(null);
    } catch {
      setPhase("failed");
      setError("Registrar-assisted consent could not be requested.");
    } finally {
      setPending(false);
    }
  };

  const createDraft = form.handleSubmit(async (values) => {
    setPending(true);
    setError(null);
    try {
      const created = await readJson<Draft>(
        await fetch("/api/student/shares/drafts", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify(values),
        }),
      );
      setDraft(created);
      if (!worldAvailable) {
        await requestAssistance(created.draftId);
        return;
      }
      setPhase("adult-consent");
    } catch {
      setPhase("failed");
      setError("The protected share draft could not be created.");
    } finally {
      setPending(false);
    }
  });

  const startWorldStep = async (
    purpose: "adult-share-consent" | "share-liveness",
  ) => {
    if (!draft) return;
    setPending(true);
    setError(null);
    try {
      const nextRequest = await readJson<WorldIdFlowRequest>(
        await fetch("/api/integrations/world/request", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ purpose, subjectId: draft.draftId }),
        }),
      );
      setWorldRequest(nextRequest);
      setWorldOpen(true);
    } catch {
      if (purpose === "adult-share-consent") {
        await requestAssistance(draft.draftId);
      } else {
        setError("Selfie Check could not be started. You can try again.");
      }
    } finally {
      setPending(false);
    }
  };

  const activate = async () => {
    if (!draft) return;
    setPhase("activating");
    setPending(true);
    try {
      const activated = await readJson<Activation>(
        await fetch(
          `/api/student/shares/drafts/${encodeURIComponent(draft.draftId)}/activate`,
          { method: "POST" },
        ),
      );
      setActivation(activated);
      setPhase("active");
    } catch {
      setPhase("failed");
      setError("Both checks succeeded, but the share could not be activated.");
    } finally {
      setPending(false);
    }
  };

  const verifyWorldStep = async (result: IDKitResult) => {
    if (!worldRequest) throw new Error("World challenge is missing.");
    const response = await fetch(
      `/api/integrations/world/verify?challengeId=${encodeURIComponent(worldRequest.challengeId)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(result),
      },
    );
    await readJson(response);
    if (worldRequest.purpose === "adult-share-consent") {
      setPhase("selfie-check");
      setWorldRequest(null);
    } else {
      setWorldRequest(null);
      await activate();
    }
  };

  const reset = () => {
    form.reset();
    setActivation(null);
    setCopied(false);
    setDraft(null);
    setError(null);
    setPhase("details");
    setWorldOpen(false);
    setWorldRequest(null);
  };

  const copyToken = async () => {
    if (!activation) return;
    await navigator.clipboard.writeText(activation.shareToken);
    setCopied(true);
  };

  return (
    <Card className="border-lozzi-navy/15 mb-8 overflow-hidden shadow-none">
      <CardHeader className="bg-lozzi-navy text-white sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-lozzi-gold text-xs font-semibold tracking-[0.18em] uppercase">
            Sensitive share
          </p>
          <CardTitle className="font-heading mt-1 text-2xl">
            Create protected access
          </CardTitle>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            A 10 to 30-minute record share discloses only the sections you
            select and requires adult self-consent plus a fresh presence check.
          </p>
        </div>
        <Badge className="mt-2 border-white/20 bg-white/5 text-white sm:mt-0">
          {worldAvailable ? "World ready" : "World not configured"}
        </Badge>
      </CardHeader>
      <CardContent className="p-5 sm:p-6">
        <Progress
          aria-label="Protected share progress"
          className="mb-6"
          value={progressByPhase[phase]}
        />

        {phase === "details" ? (
          <form className="max-w-xl space-y-4" onSubmit={createDraft}>
            <div className="space-y-2">
              <Label htmlFor="share-recipient">Recipient or purpose</Label>
              <Input
                id="share-recipient"
                placeholder="Graduate admissions office"
                aria-invalid={Boolean(form.formState.errors.recipientLabel)}
                {...form.register("recipientLabel")}
              />
              {form.formState.errors.recipientLabel ? (
                <p role="alert" className="text-destructive text-xs">
                  Enter a recipient label between 2 and 120 characters.
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  The label is visible in your share history. Do not enter
                  private contact information.
                </p>
              )}
            </div>
            <fieldset className="space-y-3">
              <legend className="text-sm leading-none font-medium">
                Information to disclose
              </legend>
              <p className="text-muted-foreground text-xs">
                Nothing is selected by default. Choose only what this recipient
                needs.
              </p>
              <div className="space-y-2">
                {scopeOptions.map((option) => {
                  const inputId = `share-scope-${option.value}`;
                  const descriptionId = `share-scope-${option.value}-description`;
                  return (
                    <div
                      key={option.value}
                      className="hover:bg-muted/50 flex gap-3 border p-3"
                    >
                      <input
                        id={inputId}
                        type="checkbox"
                        value={option.value}
                        aria-label={option.label}
                        aria-describedby={descriptionId}
                        className="accent-lozzi-teal mt-0.5 size-4 shrink-0"
                        {...form.register("scopes")}
                      />
                      <span>
                        <Label
                          htmlFor={inputId}
                          className="block cursor-pointer text-sm font-medium"
                        >
                          {option.label}
                        </Label>
                        <span
                          id={descriptionId}
                          className="text-muted-foreground mt-0.5 block text-xs"
                        >
                          {option.description}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
              {form.formState.errors.scopes ? (
                <p role="alert" className="text-destructive text-xs">
                  Select at least one section to share.
                </p>
              ) : null}
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="share-expiry">Access duration</Label>
              <select
                id="share-expiry"
                className="border-input bg-background h-9 w-full border px-3 text-sm"
                {...form.register("expiryMinutes", { valueAsNumber: true })}
              >
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
              </select>
              <p className="text-muted-foreground text-xs">
                Access stops automatically at the selected time.
              </p>
            </div>
            {!worldAvailable ? (
              <div className="border-lozzi-gold/30 bg-lozzi-gold/5 flex gap-3 border p-3 text-sm">
                <ShieldAlert
                  aria-hidden="true"
                  className="text-lozzi-gold mt-0.5 size-4 shrink-0"
                />
                <p>
                  World step-up is {worldCapability.status.replace("-", " ")}.
                  Creating this draft will route consent to a registrar; no age
                  result will be disclosed.
                </p>
              </div>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <ShieldCheck aria-hidden="true" />
              )}
              Create protected share
            </Button>
          </form>
        ) : phase === "adult-consent" ? (
          <Step
            number="1 of 2"
            title="Confirm adult self-consent"
            description="World will attest only whether the minimum-age requirement is met. Lozzi receives no birth date, name, document number, nationality, or document image."
          >
            <Button
              type="button"
              disabled={pending}
              onClick={() => startWorldStep("adult-share-consent")}
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <ShieldCheck aria-hidden="true" />
              )}
              Continue with World
            </Button>
          </Step>
        ) : phase === "selfie-check" ? (
          <Step
            number="2 of 2"
            title="Complete a fresh presence check"
            description="Selfie Check confirms that you are present for this specific share. Face data and proof bodies are never stored by Lozzi."
          >
            <Button
              type="button"
              disabled={pending}
              onClick={() => startWorldStep("share-liveness")}
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <ShieldCheck aria-hidden="true" />
              )}
              Start Selfie Check
            </Button>
          </Step>
        ) : phase === "activating" ? (
          <Status
            icon={
              <LoaderCircle
                aria-hidden="true"
                className="text-lozzi-teal size-8 animate-spin"
              />
            }
            title="Activating scoped access"
            description="Both privacy checks succeeded. Lozzi is creating the expiring grant."
          />
        ) : phase === "active" && activation ? (
          <div role="status" className="max-w-2xl">
            <CheckCircle2
              aria-hidden="true"
              className="text-lozzi-teal size-9"
            />
            <h3 className="font-heading mt-3 text-2xl">Share activated</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Copy this one-time token now. Lozzi stores only its hash, and it
              expires{" "}
              {new Intl.DateTimeFormat("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(activation.expiresAt))}
              .
            </p>
            {activation.chainStatus === "local_private" ? (
              <p className="mt-3 border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
                Verified privately in Lozzi. This share has no onchain
                confirmation yet.
              </p>
            ) : null}
            <div className="bg-muted mt-4 flex items-center gap-2 border p-3">
              <code className="min-w-0 flex-1 truncate text-xs">
                {activation.shareToken}
              </code>
              <Button type="button" variant="outline" onClick={copyToken}>
                {copied ? (
                  <Check aria-hidden="true" />
                ) : (
                  <Clipboard aria-hidden="true" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-5"
              onClick={reset}
            >
              Create another share
            </Button>
          </div>
        ) : phase === "assisted" ? (
          <Status
            icon={
              <ShieldAlert
                aria-hidden="true"
                className="text-lozzi-gold size-8"
              />
            }
            title="Registrar review requested"
            description="The private World step could not be completed. A registrar can review consent without receiving an age result or identity details."
          >
            <Button type="button" variant="outline" onClick={reset}>
              Start another share
            </Button>
          </Status>
        ) : (
          <Status
            icon={
              <ShieldAlert
                aria-hidden="true"
                className="text-destructive size-8"
              />
            }
            title="The protected share was not completed"
            description={
              error ?? "No grant was activated. You can safely start again."
            }
          >
            <Button type="button" variant="outline" onClick={reset}>
              Start again
            </Button>
          </Status>
        )}

        {error && phase !== "failed" ? (
          <p role="alert" className="text-destructive mt-4 text-sm">
            {error}
          </p>
        ) : null}
      </CardContent>

      {worldRequest ? (
        <WorldIdFlowDialog
          open={worldOpen}
          request={worldRequest}
          onOpenChange={setWorldOpen}
          onVerify={verifyWorldStep}
          onFlowError={() => {
            if (worldRequest.purpose === "adult-share-consent") {
              void requestAssistance();
            } else {
              setError("Selfie Check was not completed. You can try again.");
            }
          }}
        />
      ) : null}
    </Card>
  );
}

function Step({
  children,
  description,
  number,
  title,
}: {
  readonly children: React.ReactNode;
  readonly description: string;
  readonly number: string;
  readonly title: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-lozzi-teal text-xs font-semibold tracking-[0.16em] uppercase">
        Step {number}
      </p>
      <h3 className="font-heading mt-1 text-2xl">{title}</h3>
      <p className="text-muted-foreground mt-2 text-sm leading-6">
        {description}
      </p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Status({
  children,
  description,
  icon,
  title,
}: {
  readonly children?: React.ReactNode;
  readonly description: string;
  readonly icon: React.ReactNode;
  readonly title: string;
}) {
  return (
    <div role="status" className="max-w-2xl">
      {icon}
      <h3 className="font-heading mt-3 text-2xl">{title}</h3>
      <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}
