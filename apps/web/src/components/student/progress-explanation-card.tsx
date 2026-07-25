"use client";

import {
  PROGRESS_EXPLANATION_DISCLAIMER,
  type CapabilityState,
  type ProgressExplanation,
} from "@lozzi/domain";
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProgressExplanationCardProps {
  readonly capability: CapabilityState;
}

interface ProgressResponse {
  readonly error?: string;
  readonly explanation?: ProgressExplanation;
  readonly mode?: "available" | "mock-development";
}

const statusLabel = (capability: CapabilityState) => {
  if (capability.status === "available") return "Available";
  if (capability.status === "mock-development") return "Development mock";
  if (capability.status === "failed") return "Unavailable";
  return "Not configured";
};

export function ProgressExplanationCard({
  capability,
}: ProgressExplanationCardProps) {
  const [explanation, setExplanation] = useState<ProgressExplanation | null>(
    null,
  );
  const [mode, setMode] = useState<ProgressResponse["mode"]>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled =
    capability.status === "available" ||
    capability.status === "mock-development";

  const explain = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/zero-g/progress", {
        method: "POST",
      });
      const payload = (await response.json()) as ProgressResponse;
      if (!response.ok || !payload.explanation) {
        throw new Error(
          payload.error ?? "The progress explanation could not be created.",
        );
      }
      setExplanation(payload.explanation);
      setMode(payload.mode);
    } catch (explanationError) {
      setError(
        explanationError instanceof Error
          ? explanationError.message
          : "The progress explanation could not be created.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="border-lozzi-gold/30 bg-lozzi-gold/5 h-fit rounded-sm shadow-none">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <span className="bg-lozzi-navy text-lozzi-ivory flex size-9 shrink-0 items-center justify-center rounded-sm">
            <Sparkles aria-hidden="true" className="size-4" />
          </span>
          <Badge
            variant="outline"
            className={
              enabled
                ? "border-lozzi-teal/30 text-lozzi-teal"
                : "text-muted-foreground"
            }
          >
            {statusLabel(capability)}
          </Badge>
        </div>
        <div>
          <CardTitle className="font-heading text-lg">
            Explain my progress
          </CardTitle>
          <p className="text-muted-foreground mt-2 text-xs leading-5">
            Optional 0G assistance explains the deterministic audit shown here.
            It cannot change requirements or graduation eligibility.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {explanation ? (
          <>
            {mode === "mock-development" ? (
              <p className="border-lozzi-gold/40 bg-lozzi-gold/10 rounded-sm border px-3 py-2 text-xs">
                Development mock — no 0G provider or onchain storage call was
                made.
              </p>
            ) : (
              <p className="text-lozzi-teal flex items-center gap-2 text-xs font-medium">
                <ShieldCheck aria-hidden="true" className="size-4" />
                Encrypted input and output verified
              </p>
            )}
            <p className="text-sm leading-6">{explanation.summary}</p>
            {explanation.progressHighlights.length ? (
              <section aria-labelledby="progress-highlights">
                <h3
                  id="progress-highlights"
                  className="text-[10px] font-semibold tracking-wider uppercase"
                >
                  Highlights
                </h3>
                <ul className="mt-2 space-y-2">
                  {explanation.progressHighlights.map((highlight) => (
                    <li
                      key={highlight}
                      className="flex gap-2 text-xs leading-5"
                    >
                      <CheckCircle2
                        aria-hidden="true"
                        className="text-lozzi-teal mt-0.5 size-3.5 shrink-0"
                      />
                      {highlight}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {explanation.risks.length ? (
              <section aria-labelledby="progress-risks">
                <h3
                  id="progress-risks"
                  className="text-[10px] font-semibold tracking-wider uppercase"
                >
                  Check with your advisor
                </h3>
                <ul className="mt-2 space-y-2">
                  {explanation.risks.map((risk) => (
                    <li key={risk} className="flex gap-2 text-xs leading-5">
                      <AlertTriangle
                        aria-hidden="true"
                        className="text-lozzi-gold mt-0.5 size-3.5 shrink-0"
                      />
                      {risk}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {explanation.possibleNextCourses.length ? (
              <section aria-labelledby="possible-next-courses">
                <h3
                  id="possible-next-courses"
                  className="text-[10px] font-semibold tracking-wider uppercase"
                >
                  Possible next courses
                </h3>
                <ul className="mt-2 space-y-3">
                  {explanation.possibleNextCourses.map((course) => (
                    <li key={course.courseCode} className="text-xs leading-5">
                      <span className="font-semibold">{course.courseCode}</span>{" "}
                      — {course.reason}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : (
          <Button
            type="button"
            onClick={explain}
            disabled={!enabled || pending}
            className="w-full"
          >
            {pending ? (
              <>
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
                Encrypting and verifying…
              </>
            ) : (
              "Explain my progress"
            )}
          </Button>
        )}
        {pending ? (
          <p role="status" className="text-muted-foreground text-xs leading-5">
            Storage and compute confirmations may take a minute. Keep this page
            open.
          </p>
        ) : null}
        {!enabled ? (
          <p className="text-muted-foreground text-xs leading-5">
            Add the server-side 0G Router, Storage, signer, and key-wrapping
            credentials to enable this option.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-destructive text-xs leading-5">
            {error}
          </p>
        ) : null}
        <p className="text-muted-foreground border-t pt-3 text-[11px] leading-5">
          {explanation?.disclaimer ?? PROGRESS_EXPLANATION_DISCLAIMER}
        </p>
      </CardContent>
    </Card>
  );
}
