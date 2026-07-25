import { CheckCircle2, TriangleAlert } from "lucide-react";

import type { RegistrarActionResult } from "@/lib/registrar/mutation-context";

export function MutationFeedback({
  result,
}: {
  readonly result?: RegistrarActionResult;
}) {
  if (!result?.error && !result?.success) return null;

  return (
    <div
      role={result.error ? "alert" : "status"}
      className={
        result.error
          ? "border-destructive/25 bg-destructive/5 text-destructive flex gap-2 rounded-sm border px-3 py-2 text-xs"
          : "border-lozzi-teal/25 bg-lozzi-teal/5 text-lozzi-teal flex gap-2 rounded-sm border px-3 py-2 text-xs"
      }
    >
      {result.error ? (
        <TriangleAlert
          className="mt-0.5 size-3.5 shrink-0"
          aria-hidden="true"
        />
      ) : (
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      )}
      {result.error ?? result.success}
    </div>
  );
}
