"use client";

import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AdvisorError({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <div
      className="bg-card rounded-sm border p-8 text-center shadow-sm"
      role="alert"
    >
      <TriangleAlert
        className="text-lozzi-gold mx-auto size-8"
        aria-hidden="true"
      />
      <h1 className="font-heading mt-4 text-2xl font-semibold">
        The review queue could not be loaded
      </h1>
      <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-6">
        No proposal or official record was changed. Try the scoped request
        again, or contact an institution administrator if the issue persists.
      </p>
      <Button className="mt-5" type="button" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
