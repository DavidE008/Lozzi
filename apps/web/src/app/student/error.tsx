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
    <div
      className="border-destructive/25 bg-card rounded-sm border p-8 text-center"
      role="alert"
    >
      <AlertTriangle
        className="text-destructive mx-auto size-9"
        aria-hidden="true"
      />
      <h1 className="font-heading mt-4 text-2xl font-semibold">
        Your workspace could not be loaded
      </h1>
      <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-6">
        Your data remains protected. Try the request again, or contact your
        registrar if the issue persists.
      </p>
      <Button className="mt-5" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
