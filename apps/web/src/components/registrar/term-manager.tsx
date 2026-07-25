"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  createTerm,
  deactivateTerm,
  updateTermStatus,
} from "@/app/registrar/terms/actions";
import { MutationFeedback } from "@/components/registrar/mutation-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RegistrarActionResult } from "@/lib/registrar/mutation-context";

const selectClass =
  "border-input bg-background h-9 w-full rounded-sm border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20";
const schema = z
  .object({
    code: z.string().trim().min(2).max(24),
    name: z.string().trim().min(2).max(120),
    startsOn: z.string().min(1),
    endsOn: z.string().min(1),
    registrationOpensAt: z.string().optional(),
    registrationClosesAt: z.string().optional(),
    addDropDeadline: z.string().optional(),
    withdrawalDeadline: z.string().optional(),
    gradesDueAt: z.string().optional(),
    status: z.enum(["planned", "registration_open", "in_progress", "closed"]),
    maxCredits: z.number().positive().max(99),
    minCredits: z.number().min(0).max(99),
  })
  .refine((value) => value.endsOn > value.startsOn, {
    message: "The term must end after it starts.",
    path: ["endsOn"],
  });

export function TermManager({
  institutionId,
}: {
  readonly institutionId: string;
}) {
  const router = useRouter();
  const [result, setResult] = useState<RegistrarActionResult>();
  const [pending, startTransition] = useTransition();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: "",
      name: "",
      startsOn: "",
      endsOn: "",
      registrationOpensAt: "",
      registrationClosesAt: "",
      addDropDeadline: "",
      withdrawalDeadline: "",
      gradesDueAt: "",
      status: "planned",
      maxCredits: 18,
      minCredits: 0,
    },
  });

  return (
    <details className="bg-card mb-7 rounded-sm border">
      <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">
        Add academic term
      </summary>
      <form
        className="space-y-5 border-t p-5"
        onSubmit={form.handleSubmit((values) =>
          startTransition(async () => {
            setResult(undefined);
            const next = await createTerm({ institutionId, ...values });
            setResult(next);
            if (next.success) {
              form.reset();
              router.refresh();
            }
          }),
        )}
      >
        <MutationFeedback result={result} />
        <div className="grid gap-4 sm:grid-cols-[0.65fr_1.35fr]">
          <div className="space-y-1.5">
            <Label htmlFor="term-code">Code</Label>
            <Input
              id="term-code"
              placeholder="SPRING-2027"
              {...form.register("code")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="term-name">Name</Label>
            <Input
              id="term-name"
              placeholder="Spring 2027"
              {...form.register("name")}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="term-start">Starts</Label>
            <Input id="term-start" type="date" {...form.register("startsOn")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="term-end">Ends</Label>
            <Input id="term-end" type="date" {...form.register("endsOn")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="term-min-credits">Minimum credits</Label>
            <Input
              id="term-min-credits"
              type="number"
              step="0.5"
              {...form.register("minCredits", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="term-max-credits">Maximum credits</Label>
            <Input
              id="term-max-credits"
              type="number"
              step="0.5"
              {...form.register("maxCredits", { valueAsNumber: true })}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["registrationOpensAt", "Registration opens"],
            ["registrationClosesAt", "Registration closes"],
            ["addDropDeadline", "Add/drop deadline"],
            ["withdrawalDeadline", "Withdrawal deadline"],
            ["gradesDueAt", "Grades due"],
          ].map(([field, label]) => (
            <div key={field} className="space-y-1.5">
              <Label htmlFor={`term-${field}`}>{label}</Label>
              <Input
                id={`term-${field}`}
                type="datetime-local"
                {...form.register(
                  field as
                    | "registrationOpensAt"
                    | "registrationClosesAt"
                    | "addDropDeadline"
                    | "withdrawalDeadline"
                    | "gradesDueAt",
                )}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="w-56 space-y-1.5">
            <Label htmlFor="term-status">Initial status</Label>
            <select
              id="term-status"
              className={selectClass}
              {...form.register("status")}
            >
              <option value="planned">Planned</option>
              <option value="registration_open">Registration open</option>
              <option value="in_progress">In progress</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Plus aria-hidden="true" />
            )}
            {pending ? "Saving…" : "Add term"}
          </Button>
        </div>
      </form>
    </details>
  );
}

export function TermControls({
  institutionId,
  id,
  status,
}: {
  readonly institutionId: string;
  readonly id: string;
  readonly status: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  const run = (operation: () => Promise<RegistrarActionResult>) =>
    startTransition(async () => {
      setMessage(undefined);
      const result = await operation();
      setMessage(result.error);
      if (result.success) router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select
        aria-label="Term status"
        className={`${selectClass} w-44`}
        defaultValue={status}
        disabled={pending}
        onChange={(event) =>
          run(() =>
            updateTermStatus({
              institutionId,
              id,
              status: event.target.value as
                "planned" | "registration_open" | "in_progress" | "closed",
            }),
          )
        }
      >
        <option value="planned">Planned</option>
        <option value="registration_open">Registration open</option>
        <option value="in_progress">In progress</option>
        <option value="closed">Closed</option>
      </select>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => run(() => deactivateTerm({ institutionId, id }))}
      >
        {pending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Archive aria-hidden="true" />
        )}
        Deactivate
      </Button>
      {message ? (
        <span className="text-destructive w-full text-right text-[10px]">
          {message}
        </span>
      ) : null}
    </div>
  );
}
