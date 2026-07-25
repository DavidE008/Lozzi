"use client";

import { calculateGrade, type GradeComponents } from "@lozzi/domain";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Info,
  Keyboard,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  saveGradeDrafts,
  submitSectionGrades,
} from "@/app/instructor/sections/[sectionId]/grades/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  InstructorGradebook,
  InstructorGradeRow,
} from "@/lib/repositories/grades";
import { cn } from "@/lib/utils";

interface GradeFormValues {
  readonly grades: readonly (GradeComponents & {
    readonly enrollmentId: string;
  })[];
}

const lifecycle = [
  { state: "draft", label: "Draft", detail: "In progress" },
  { state: "submitted", label: "Submitted", detail: "Pending review" },
  { state: "approved", label: "Approved", detail: "Ready to publish" },
  { state: "published", label: "Published", detail: "Official" },
] as const;

const stateIndex = {
  draft: 0,
  submitted: 1,
  approved: 2,
  published: 3,
} as const;

const toDefaultGrade = (row: InstructorGradeRow) => ({
  enrollmentId: row.enrollment_id,
  participationScore: row.participation_score,
  assignmentAverage: row.assignment_average,
  finalExamScore: row.final_exam_score,
});

const normalizeGrade = (
  grade: (GradeComponents & { readonly enrollmentId: string }) | undefined,
  fallback: InstructorGradeRow,
) => ({
  enrollmentId: grade?.enrollmentId ?? fallback.enrollment_id,
  participationScore: grade?.participationScore ?? null,
  assignmentAverage: grade?.assignmentAverage ?? null,
  finalExamScore: grade?.finalExamScore ?? null,
});

const formatSavedAt = (value: string | null) => {
  if (!value) return "Not saved yet";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  }).format(new Date(value));
};

export function GradeEntryWorkspace({
  gradebook,
}: {
  readonly gradebook: InstructorGradebook;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const { section, rows, lifecycleState } = gradebook;
  const editable = lifecycleState === "draft";
  const { control, register, getValues } = useForm<GradeFormValues>({
    defaultValues: { grades: rows.map(toDefaultGrade) },
  });
  const watchedGrades = useWatch({ control, name: "grades" });
  const calculations = rows.map((row, index) =>
    calculateGrade(normalizeGrade(watchedGrades?.[index], row)),
  );
  const completeCount = calculations.filter(({ complete }) => complete).length;
  const notStartedCount = rows.filter((row, index) => {
    const grade = normalizeGrade(watchedGrades?.[index], row);
    return (
      grade.participationScore === null &&
      grade.assignmentAverage === null &&
      grade.finalExamScore === null
    );
  }).length;
  const needsAttentionCount = rows.length - completeCount - notStartedCount;
  const currentStep = stateIndex[lifecycleState];
  const lastSavedAt = useMemo(
    () =>
      rows
        .map(({ last_saved_at }) => last_saved_at)
        .filter((value): value is string => value !== null)
        .sort()
        .at(-1) ?? section.last_saved_at,
    [rows, section.last_saved_at],
  );

  const formGrades = () =>
    getValues("grades").map((grade, index) =>
      normalizeGrade(grade, rows[index] as InstructorGradeRow),
    );

  const save = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await saveGradeDrafts({
        sectionId: section.section_id,
        grades: formGrades(),
        idempotencyKey: crypto.randomUUID(),
      });
      setFeedback(result.message);
      if (result.success) router.refresh();
    });
  };

  const submit = () => {
    setFeedback(null);
    startTransition(async () => {
      const saved = await saveGradeDrafts({
        sectionId: section.section_id,
        grades: formGrades(),
        idempotencyKey: crypto.randomUUID(),
      });
      if (!saved.success) {
        setFeedback(saved.message);
        return;
      }

      const result = await submitSectionGrades({
        sectionId: section.section_id,
        idempotencyKey: crypto.randomUUID(),
      });
      setFeedback(result.message);
      if (result.success) router.refresh();
    });
  };

  const exportCsv = () => {
    const header = [
      "Student",
      "Participation",
      "Assignment Average",
      "Final Exam",
      "Total",
      "Letter Grade",
      "State",
    ];
    const body = rows.map((row, index) => {
      const grade = normalizeGrade(watchedGrades?.[index], row);
      const calculation = calculations[index];
      return [
        row.student_display_name,
        grade.participationScore ?? "",
        grade.assignmentAverage ?? "",
        grade.finalExamScore ?? "",
        calculation?.totalScore ?? "",
        calculation?.gradeCode ?? "",
        row.lifecycle_state,
      ];
    });
    const csv = [header, ...body]
      .map((line) =>
        line
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${section.course_code.replaceAll(" ", "-")}-${section.section_code}-grades.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setFeedback("Gradebook export downloaded.");
  };

  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground mb-6 flex flex-wrap items-center gap-2 text-sm"
      >
        <a className="text-blue-700 hover:underline" href="/instructor">
          Sections
        </a>
        <span aria-hidden="true">/</span>
        <span className="text-blue-700">{section.course_code}</span>
        <span aria-hidden="true">/</span>
        <span className="text-foreground">Grade entry</span>
      </nav>

      <div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div>
          <h1 className="font-heading text-4xl font-semibold sm:text-5xl">
            {section.course_code} · {section.course_title}
          </h1>
          <p className="text-lozzi-slate mt-3 text-sm">
            Section {section.section_code} · {section.schedule} ·{" "}
            {section.roster_count} enrolled
          </p>
        </div>
        <div className="flex min-w-[17rem] gap-3 rounded-sm border bg-white p-4">
          <UserRound className="mt-0.5 size-5" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">Assigned section</p>
            <p className="text-muted-foreground mt-1 text-xs">
              You can only manage this section.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-sm border bg-white">
            <ol
              className="grid grid-cols-2 divide-x border-b lg:grid-cols-4"
              aria-label="Grade publication lifecycle"
            >
              {lifecycle.map((step, index) => {
                const active = index === currentStep;
                const complete = index < currentStep;
                return (
                  <li
                    key={step.state}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "flex min-h-[5.75rem] items-center gap-3 px-5 py-4",
                      active && "border-lozzi-teal bg-lozzi-teal/[0.035]",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                        active && "bg-lozzi-teal border-lozzi-teal text-white",
                        complete &&
                          "border-lozzi-teal text-lozzi-teal bg-lozzi-teal/5",
                      )}
                    >
                      {complete ? (
                        <Check className="size-4" aria-hidden="true" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-medium">
                        {step.label}
                      </span>
                      <span className="text-muted-foreground mt-0.5 block text-xs">
                        {step.detail}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="text-lozzi-slate flex items-start gap-3 px-5 py-4 text-xs">
              <Info
                className="size-5 shrink-0"
                strokeWidth={1.6}
                aria-hidden="true"
              />
              Grades are not published to students until the registrar publishes
              them.
            </div>
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-4 text-xs">
            <button
              type="button"
              onClick={() =>
                setFeedback(
                  "Use Tab and Shift+Tab to move between grade fields.",
                )
              }
              className="flex items-center gap-2 text-blue-700 hover:underline"
            >
              <Keyboard className="size-4" aria-hidden="true" />
              Keyboard shortcuts
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="flex items-center gap-2 text-blue-700 hover:underline"
            >
              <Download className="size-4" aria-hidden="true" />
              Export
            </button>
          </div>

          <div className="mt-3 overflow-x-auto rounded-sm border bg-white">
            <table className="w-full min-w-[58rem] border-collapse text-left">
              <thead>
                <tr className="border-b text-xs font-medium">
                  <th className="w-[23%] px-5 py-4 font-medium">
                    Student
                    <span className="text-muted-foreground mt-1 block font-normal">
                      ({rows.length} enrolled)
                    </span>
                  </th>
                  <th className="w-[14%] border-l px-4 py-4 text-center font-medium">
                    Participation
                    <span className="text-muted-foreground mt-1 block font-normal">
                      (10%)
                    </span>
                  </th>
                  <th className="w-[15%] border-l px-4 py-4 text-center font-medium">
                    Assignment Avg.
                    <span className="text-muted-foreground mt-1 block font-normal">
                      (40%)
                    </span>
                  </th>
                  <th className="w-[14%] border-l px-4 py-4 text-center font-medium">
                    Final Exam
                    <span className="text-muted-foreground mt-1 block font-normal">
                      (50%)
                    </span>
                  </th>
                  <th className="w-[11%] border-l px-4 py-4 text-center font-medium">
                    Total
                    <span className="text-muted-foreground mt-1 block font-normal">
                      (100%)
                    </span>
                  </th>
                  <th className="w-[11%] border-l px-4 py-4 text-center font-medium">
                    Letter Grade
                  </th>
                  <th className="w-[12%] border-l px-4 py-4 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const calculation = calculations[index];
                  const rowComplete = calculation?.complete ?? false;
                  return (
                    <tr
                      key={row.enrollment_id}
                      className="border-b last:border-b-0"
                    >
                      <td className="px-5 py-5">
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground text-xs">
                            {index + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium">
                              {row.student_display_name}
                            </p>
                            {row.correction_reason_code ? (
                              <p className="text-lozzi-gold mt-1 text-[10px] font-medium">
                                Correction ·{" "}
                                {row.correction_reason_code.replaceAll(
                                  "_",
                                  " ",
                                )}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="border-l px-4 py-5 text-center">
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          step="0.1"
                          disabled={!editable}
                          aria-label={`${row.student_display_name} participation score out of 10`}
                          className="mx-auto h-11 w-24 rounded-sm text-center"
                          {...register(
                            `grades.${index}.participationScore` as const,
                            {
                              setValueAs: (value) =>
                                value === "" ? null : Number(value),
                            },
                          )}
                        />
                        <span className="text-muted-foreground mt-2 block text-xs">
                          / 10
                        </span>
                      </td>
                      <td className="border-l px-4 py-5 text-center">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step="0.1"
                          disabled={!editable}
                          aria-label={`${row.student_display_name} assignment average percent`}
                          className="mx-auto h-11 w-24 rounded-sm text-center"
                          {...register(
                            `grades.${index}.assignmentAverage` as const,
                            {
                              setValueAs: (value) =>
                                value === "" ? null : Number(value),
                            },
                          )}
                        />
                        <span className="text-muted-foreground mt-2 block text-xs">
                          %
                        </span>
                      </td>
                      <td className="border-l px-4 py-5 text-center">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step="0.1"
                          disabled={!editable}
                          aria-invalid={
                            editable &&
                            calculation?.missingFields.includes(
                              "finalExamScore",
                            )
                              ? true
                              : undefined
                          }
                          aria-label={`${row.student_display_name} final exam percent`}
                          className="mx-auto h-11 w-24 rounded-sm text-center"
                          {...register(
                            `grades.${index}.finalExamScore` as const,
                            {
                              setValueAs: (value) =>
                                value === "" ? null : Number(value),
                            },
                          )}
                        />
                        <span className="text-muted-foreground mt-2 block text-xs">
                          %
                        </span>
                      </td>
                      <td className="border-l px-4 py-5 text-center">
                        <p className="font-heading text-xl font-semibold">
                          {calculation?.totalScore ?? "—"}
                        </p>
                        <span className="text-muted-foreground text-xs">%</span>
                      </td>
                      <td className="border-l px-4 py-5 text-center">
                        <div className="mx-auto flex h-11 w-20 items-center justify-center rounded-sm border bg-white text-sm font-medium">
                          {calculation?.gradeCode ?? "—"}
                        </div>
                      </td>
                      <td className="border-l px-4 py-5">
                        <div
                          className={cn(
                            "flex items-start gap-2 text-xs font-medium",
                            rowComplete
                              ? "text-lozzi-teal"
                              : "text-destructive",
                          )}
                        >
                          {rowComplete ? (
                            <CheckCircle2
                              className="size-4 shrink-0"
                              aria-hidden="true"
                            />
                          ) : (
                            <AlertCircle
                              className="size-4 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                          {rowComplete
                            ? editable
                              ? "Complete"
                              : lifecycleState
                            : "Needs attention"}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!rows.length ? (
              <div className="text-muted-foreground p-10 text-center text-sm">
                No eligible students are in this roster.
              </div>
            ) : null}
            <div className="text-muted-foreground flex items-center justify-between border-t px-5 py-4 text-xs">
              <span>
                Showing {rows.length} of {section.roster_count} students
              </span>
              <span>Official outcomes remain offchain.</span>
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-sm border bg-white p-5">
          <h2 className="font-heading text-lg font-semibold">
            Submission summary
          </h2>
          <dl className="mt-6 space-y-5 text-sm">
            <div className="grid grid-cols-[1.5rem_2rem_1fr] items-center gap-2">
              <CheckCircle2
                className="text-lozzi-teal size-5"
                aria-hidden="true"
              />
              <dd>{completeCount}</dd>
              <dt className="text-lozzi-slate">Complete</dt>
            </div>
            <div className="grid grid-cols-[1.5rem_2rem_1fr] items-center gap-2">
              <AlertCircle
                className="text-lozzi-gold size-5"
                aria-hidden="true"
              />
              <dd>{needsAttentionCount}</dd>
              <dt className="text-lozzi-slate">Needs attention</dt>
            </div>
            <div className="grid grid-cols-[1.5rem_2rem_1fr] items-center gap-2">
              <span
                className="border-lozzi-slate/60 size-5 rounded-full border"
                aria-hidden="true"
              />
              <dd>{notStartedCount}</dd>
              <dt className="text-lozzi-slate">Not started</dt>
            </div>
          </dl>

          <div className="mt-6 border-t pt-5">
            <p className="text-xs font-semibold">Last saved</p>
            <p className="text-lozzi-slate mt-2 text-xs">
              {formatSavedAt(lastSavedAt)}
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <Button
              type="button"
              variant="outline"
              disabled={!editable || pending || !rows.length}
              onClick={save}
              className="h-12 w-full rounded-sm"
            >
              <FileText aria-hidden="true" />
              {pending ? "Saving…" : "Save draft"}
            </Button>
            <Button
              type="button"
              disabled={
                !editable ||
                pending ||
                !rows.length ||
                completeCount !== rows.length
              }
              onClick={submit}
              className="h-12 w-full rounded-sm"
            >
              <Send aria-hidden="true" />
              Submit grades
            </Button>
            {editable && completeCount !== rows.length ? (
              <p className="text-lozzi-slate text-xs leading-5">
                You must resolve all issues before submitting.
              </p>
            ) : null}
          </div>

          <div
            aria-live="polite"
            className="text-lozzi-slate mt-5 min-h-5 text-xs leading-5"
          >
            {feedback}
          </div>

          <div className="mt-5 flex gap-3 border-t pt-5">
            <ShieldCheck className="size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">Audit note</p>
              <p className="text-lozzi-slate mt-2 text-xs leading-5">
                After submission, changes require a grade correction workflow
                and registrar approval. Contact the registrar for support.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
