"use client";

import type { PublicVerifierResult } from "@lozzi/domain";
import {
  Clock3,
  Link2Off,
  LoaderCircle,
  SearchCheck,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const tokenFromFragment = (fragment: string): string | null => {
  if (!fragment.startsWith("#")) return null;
  const token = new URLSearchParams(fragment.slice(1)).get("token")?.trim();
  return token || null;
};

const statusContent = {
  chain_confirmed: {
    detail:
      "The private disclosure and its grant match independently read registry evidence.",
    label: "Chain-confirmed commitment",
  },
  configuration_unavailable: {
    detail:
      "The private disclosure is valid, but independent registry verification is unavailable.",
    label: "Registry unavailable",
  },
  locally_verified: {
    detail:
      "Lozzi verified this private disclosure locally. It is not independently chain-confirmed.",
    label: "Locally verified disclosure",
  },
  pending_anchor: {
    detail:
      "The private disclosure is valid locally while its commitment awaits chain reconciliation.",
    label: "Chain anchor pending",
  },
} as const;

const readJson = async (response: Response): Promise<PublicVerifierResult> => {
  const payload = (await response.json()) as PublicVerifierResult & {
    readonly error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error ?? "The share could not be verified.");
  }
  return payload;
};

export function VerifierForm() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<PublicVerifierResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async (candidate: string) => {
    const submittedToken = candidate.trim();
    if (!submittedToken) {
      setError("Paste a share token to continue.");
      return;
    }
    setToken("");
    setPending(true);
    setError(null);
    setResult(null);
    try {
      setResult(
        await readJson(
          await fetch("/api/verify", {
            body: JSON.stringify({ token: submittedToken }),
            headers: { "content-type": "application/json" },
            method: "POST",
          }),
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The share could not be verified.",
      );
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    const fragmentToken = tokenFromFragment(window.location.hash);
    const hadQueryString = window.location.search.length > 0;
    if (fragmentToken || hadQueryString) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (!fragmentToken) {
      const timeout = hadQueryString
        ? window.setTimeout(() => {
            setError(
              "Query-string tokens are not accepted. Paste the share token instead.",
            );
          }, 0)
        : null;
      return () => {
        if (timeout !== null) window.clearTimeout(timeout);
      };
    }
    const timeout = window.setTimeout(() => void verify(fragmentToken), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <div className="space-y-6">
      <Card className="border-lozzi-navy/15 shadow-none">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">
            Check a private share
          </CardTitle>
          <p className="text-muted-foreground text-sm leading-6">
            Paste the one-time token you received. Tokens stay in the request
            body, are cleared after submission, and are never accepted in query
            strings.
          </p>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void verify(token);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="share-token">Share token</Label>
              <Input
                id="share-token"
                name="share-token"
                type="password"
                value={token}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setToken(event.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Lozzi hashes the token before database lookup and never stores
                it in access history.
              </p>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <SearchCheck aria-hidden="true" />
              )}
              Verify private share
            </Button>
          </form>
          {error ? (
            <p role="alert" className="text-destructive mt-4 text-sm">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {result ? <VerifierResult result={result} /> : null}
    </div>
  );
}

function VerifierResult({ result }: { readonly result: PublicVerifierResult }) {
  if (result.status === "invalid") {
    return (
      <StateCard
        icon={<Link2Off aria-hidden="true" className="size-8" />}
        title="Share not found"
        detail="The token is invalid or the share is not available. No academic information was disclosed."
      />
    );
  }
  if (result.status === "expired" || result.status === "revoked") {
    return (
      <StateCard
        icon={
          result.status === "expired" ? (
            <Clock3 aria-hidden="true" className="size-8" />
          ) : (
            <ShieldAlert aria-hidden="true" className="size-8" />
          )
        }
        title={result.status === "expired" ? "Share expired" : "Share revoked"}
        detail={
          result.status === "expired"
            ? "This share has passed its access deadline. No academic information was disclosed."
            : "The student revoked this share. No academic information was disclosed."
        }
      >
        <p className="text-muted-foreground text-sm">
          Issuer: {result.issuer.name}
        </p>
      </StateCard>
    );
  }
  if (!("record" in result) || !("disclosure" in result)) return null;

  const content = statusContent[result.status];
  return (
    <Card aria-live="polite" className="border-lozzi-teal/30 shadow-none">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lozzi-teal text-xs font-semibold tracking-[0.16em] uppercase">
              Verification result
            </p>
            <h2 className="font-heading mt-1 text-2xl font-medium">
              {result.issuer.name}
            </h2>
          </div>
          <Badge variant="outline">{content.label}</Badge>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">{content.detail}</p>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Academic record</dt>
            <dd className="mt-1 font-medium">
              Version {result.record.versionNumber}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Access expires</dt>
            <dd className="mt-1 font-medium">
              {new Intl.DateTimeFormat("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(result.expiresAt))}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Commitment</dt>
            <dd className="mt-1 font-mono text-xs">
              {result.record.commitment.slice(0, 18)}…
            </dd>
          </div>
        </dl>

        {"program" in result.disclosure && result.disclosure.program ? (
          <DisclosureSection title="Programme">
            <p className="font-medium">{result.disclosure.program.name}</p>
            <p className="text-muted-foreground text-sm">
              {result.disclosure.program.credentialType}
            </p>
          </DisclosureSection>
        ) : null}

        {"degree-progress" in result.disclosure &&
        result.disclosure["degree-progress"] ? (
          <DisclosureSection title="Degree progress">
            <p className="text-2xl font-semibold">
              {result.disclosure["degree-progress"].progressPercent}%
            </p>
            <p className="text-muted-foreground text-sm">
              {result.disclosure["degree-progress"].creditsEarned} of{" "}
              {result.disclosure["degree-progress"].creditsRequired} credits
            </p>
          </DisclosureSection>
        ) : null}

        {"record-summary" in result.disclosure &&
        result.disclosure["record-summary"] ? (
          <DisclosureSection title="Record summary">
            <p className="font-medium">
              {result.disclosure["record-summary"].courseCount} courses ·{" "}
              {result.disclosure["record-summary"].creditsEarned} credits earned
            </p>
          </DisclosureSection>
        ) : null}

        {"full-record" in result.disclosure &&
        result.disclosure["full-record"] ? (
          <DisclosureSection title="Full record">
            <div className="overflow-x-auto">
              <table className="w-full min-w-lg text-left text-sm">
                <thead className="text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Course</th>
                    <th className="py-2 pr-3 font-medium">Title</th>
                    <th className="py-2 pr-3 font-medium">Grade</th>
                    <th className="py-2 font-medium">Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {result.disclosure["full-record"].map((course) => (
                    <tr
                      key={`${course.courseCode}:${course.publishedAt}`}
                      className="border-b last:border-0"
                    >
                      <td className="py-2 pr-3 font-medium">
                        {course.courseCode}
                      </td>
                      <td className="py-2 pr-3">{course.courseTitle}</td>
                      <td className="py-2 pr-3">{course.gradeCode}</td>
                      <td className="py-2">{course.creditHoursEarned}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DisclosureSection>
        ) : null}

        <p className="text-muted-foreground border-t pt-4 text-xs leading-5">
          World and ENS may support identity setup, but neither alone proves
          academic authenticity. This result is based on the issuing
          institution&apos;s scoped disclosure and commitment lifecycle.
        </p>
      </CardContent>
    </Card>
  );
}

function DisclosureSection({
  children,
  title,
}: {
  readonly children: React.ReactNode;
  readonly title: string;
}) {
  return (
    <section>
      <h2 className="font-heading mb-2 text-xl">{title}</h2>
      {children}
    </section>
  );
}

function StateCard({
  children,
  detail,
  icon,
  title,
}: {
  readonly children?: React.ReactNode;
  readonly detail: string;
  readonly icon: React.ReactNode;
  readonly title: string;
}) {
  return (
    <Card aria-live="polite" className="border-lozzi-gold/30 shadow-none">
      <CardContent className="pt-6">
        <div className="text-lozzi-gold">{icon}</div>
        <h2 className="font-heading mt-3 text-2xl">{title}</h2>
        <p className="text-muted-foreground mt-2 text-sm">{detail}</p>
        {children ? <div className="mt-4">{children}</div> : null}
      </CardContent>
    </Card>
  );
}
