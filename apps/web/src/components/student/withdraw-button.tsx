"use client";

import { AlertCircle, Check } from "lucide-react";
import { useState, useTransition } from "react";

import {
  type RegistrationActionResult,
  withdrawEnrollment,
} from "@/app/student/register/actions";
import { Button } from "@/components/ui/button";

export function WithdrawButton({
  enrollmentId,
}: {
  readonly enrollmentId: string;
}) {
  const [feedback, setFeedback] = useState<RegistrationActionResult | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const withdraw = () => {
    if (!window.confirm("Drop this course from your current schedule?")) return;
    startTransition(async () => {
      setFeedback(
        await withdrawEnrollment({
          enrollmentId,
          idempotencyKey: crypto.randomUUID(),
        }),
      );
    });
  };

  return (
    <div className="text-right">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={withdraw}
      >
        {isPending ? "Updating…" : "Drop course"}
      </Button>
      {feedback ? (
        <p
          role="status"
          className={
            feedback.success
              ? "mt-2 flex items-center justify-end gap-1.5 text-xs text-emerald-700"
              : "mt-2 flex items-center justify-end gap-1.5 text-xs text-rose-700"
          }
        >
          {feedback.success ? (
            <Check className="size-3.5" aria-hidden="true" />
          ) : (
            <AlertCircle className="size-3.5" aria-hidden="true" />
          )}
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
