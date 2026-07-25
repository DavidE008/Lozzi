"use client";

import type { CapabilityState } from "@lozzi/domain";
import { Bot, Check, Clipboard, LoaderCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DegreePlanAgentCardProps {
  readonly capability: CapabilityState;
}

interface Delegation {
  readonly delegationId: string;
  readonly delegationToken: string;
  readonly expiresAt: string;
  readonly scopes: readonly ["degree-plan:read", "degree-plan:propose"];
}

export function DegreePlanAgentCard({ capability }: DegreePlanAgentCardProps) {
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const available = capability.status === "available";

  const createDelegation = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/student/degree-plan/delegations", {
        method: "POST",
        headers: { "idempotency-key": crypto.randomUUID() },
      });
      const payload = (await response.json()) as Delegation & {
        readonly error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Delegation could not be created.");
      }
      setDelegation(payload);
    } catch (creationError) {
      setError(
        creationError instanceof Error
          ? creationError.message
          : "Delegation could not be created.",
      );
    } finally {
      setPending(false);
    }
  };

  const copyDelegation = async () => {
    if (!delegation) return;
    await navigator.clipboard.writeText(delegation.delegationToken);
    setCopied(true);
  };

  return (
    <Card className="h-fit rounded-sm shadow-none">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <span className="bg-lozzi-navy/5 text-lozzi-navy mb-3 flex size-9 items-center justify-center rounded-sm">
            <Bot aria-hidden="true" className="size-4" />
          </span>
          <CardTitle className="font-heading text-lg">
            Degree-plan agent
          </CardTitle>
        </div>
        <Badge
          variant="outline"
          className={
            available
              ? "border-lozzi-teal/30 text-lozzi-teal"
              : "text-muted-foreground"
          }
        >
          {available ? "Ready" : "Not configured"}
        </Badge>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm leading-6">
          Delegate one minimized read and one proposal. The agent receives
          course codes and completion flags—never your name, email, grades, or
          raw record.
        </p>

        {delegation ? (
          <div role="status" className="mt-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck
                aria-hidden="true"
                className="text-lozzi-teal size-4"
              />
              Delegation ready
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              One use per scope · Expires{" "}
              {new Intl.DateTimeFormat("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(delegation.expiresAt))}
            </p>
            <div className="bg-muted mt-3 flex items-center gap-2 border p-2">
              <code className="min-w-0 flex-1 truncate text-[11px]">
                {delegation.delegationToken}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={copyDelegation}
              >
                {copied ? (
                  <Check aria-hidden="true" />
                ) : (
                  <Clipboard aria-hidden="true" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Paste this only into Lozzi’s local demo-agent prompt. The token is
              shown once and is not stored in readable form.
            </p>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="mt-5 w-full"
            disabled={!available || pending}
            onClick={createDelegation}
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <ShieldCheck aria-hidden="true" />
            )}
            Create 30-minute delegation
          </Button>
        )}

        {error ? (
          <p role="alert" className="text-destructive mt-3 text-xs">
            {error}
          </p>
        ) : !available ? (
          <p className="text-muted-foreground mt-3 text-xs">
            {capability.detail}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
