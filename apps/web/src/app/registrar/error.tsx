"use client";

import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function RegistrarError({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <div className="flex min-h-[28rem] items-center justify-center">
      <div className="bg-card max-w-md rounded-sm border p-7 text-center shadow-sm">
        <TriangleAlert
          className="text-lozzi-gold mx-auto size-8"
          aria-hidden="true"
        />
        <h1 className="font-heading mt-4 text-2xl font-semibold">
          The workspace could not be loaded
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          Your session remains secure. Retry the scoped request, or contact an
          institution administrator if the issue continues.
        </p>
        <Button className="mt-5" type="button" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
