"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function StudentError({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <div className="rounded-sm border border-destructive/25 bg-card p-8 text-center" role="alert">
      <AlertTriangle className="mx-auto size-9 text-destructive" aria-hidden="true" />
      <h1 className="mt-4 font-heading text-2xl font-semibold">Your workspace could not be loaded</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Your data remains protected. Try the request again, or contact your registrar if
        the issue persists.
      </p>
      <Button className="mt-5" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
