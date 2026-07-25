"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  History,
  LoaderCircle,
  RefreshCcw,
  Send,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  approveGradeSubmission,
  publishGradeSubmission,
  startRegistrarGradeCorrection,
} from "@/app/registrar/records/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
  RegistrarGradeItem,
  StudentAcademicRecord,
} from "@/lib/repositories/grades";

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "Not recorded";

type CorrectionReason =
  | "clerical_error"
  | "calculation_error"
  | "incomplete_resolved"
  | "appeal_outcome"
  | "other_documented";

export function GradePublicationManager({
  queue,
  records,
}: {
  readonly queue: readonly RegistrarGradeItem[];
  readonly records: readonly (StudentAcademicRecord & {
    readonly studentDisplayName: string;
  })[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reasonByRecord, setReasonByRecord] = useState<
    Readonly<Record<string, CorrectionReason>>
  >({});

  const run = (
    itemId: string,
    action: () => Promise<{
      readonly success: boolean;
      readonly message: string;
    }>,
  ) => {
    setActiveItem(itemId);
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      setFeedback(result.message);
      setActiveItem(null);
      if (result.success) router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <Card className="gap-0 overflow-hidden rounded-sm py-0 shadow-none">
        <CardContent className="p-0">
          {queue.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[62rem] text-left">
                <thead className="bg-muted/35 text-muted-foreground border-b text-[10px] tracking-[0.12em] uppercase">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Course</th>
                    <th className="px-4 py-3 font-semibold">Submitted by</th>
                    <th className="px-4 py-3 font-semibold">Outcome</th>
                    <th className="px-4 py-3 font-semibold">State</th>
                    <th className="px-6 py-3 text-right font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {queue.map((item) => (
                    <tr key={item.grade_submission_id}>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold">
                          {item.student_display_name}
                        </p>
                        <p className="text-muted-foreground mt-1 text-[11px]">
                          {item.term_name} · Section {item.section_code}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-medium">
                          {item.course_code}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {item.course_title}
                        </p>
                      </td>
                      <td className="text-muted-foreground px-4 py-4 text-sm">
                        {item.submitted_by_display_name}
                        <span className="mt-1 block text-xs">
                          {formatDate(item.submitted_at)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-heading text-lg font-semibold">
                          {item.grade_code}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {item.total_score}%
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          variant="outline"
                          className="border-lozzi-gold/30 bg-lozzi-gold/5 text-lozzi-slate rounded-sm text-[10px] capitalize"
                        >
                          {item.state}
                        </Badge>
                        {item.correction_reason_code ? (
                          <p className="text-lozzi-gold mt-2 text-[10px]">
                            Correction ·{" "}
                            {item.correction_reason_code.replaceAll("_", " ")}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {item.state === "submitted" ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-sm"
                            disabled={pending}
                            onClick={() =>
                              run(item.grade_submission_id, () =>
                                approveGradeSubmission({
                                  gradeSubmissionId: item.grade_submission_id,
                                  idempotencyKey: crypto.randomUUID(),
                                }),
                              )
                            }
                          >
                            {activeItem === item.grade_submission_id ? (
                              <LoaderCircle
                                className="animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <CheckCircle2 aria-hidden="true" />
                            )}
                            Approve
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            className="rounded-sm"
                            disabled={pending}
                            onClick={() =>
                              run(item.grade_submission_id, () =>
                                publishGradeSubmission({
                                  gradeSubmissionId: item.grade_submission_id,
                                  idempotencyKey: crypto.randomUUID(),
                                }),
                              )
                            }
                          >
                            {activeItem === item.grade_submission_id ? (
                              <LoaderCircle
                                className="animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Send aria-hidden="true" />
                            )}
                            Publish
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-14 text-center">
              <FileCheck2
                className="text-muted-foreground/35 mx-auto size-9"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-semibold">The queue is clear</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Submitted grades will appear here for approval and publication.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="published-history-title">
        <div className="mb-4 flex items-center gap-3">
          <History className="text-lozzi-teal size-5" aria-hidden="true" />
          <div>
            <h2
              id="published-history-title"
              className="font-heading text-2xl font-semibold"
            >
              Published record history
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              Corrections create a new linked version; previous versions remain
              auditable.
            </p>
          </div>
        </div>
        <Card className="gap-0 overflow-hidden rounded-sm py-0 shadow-none">
          <CardContent className="p-0">
            {records.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[58rem] text-left text-sm">
                  <thead className="bg-muted/35 text-muted-foreground border-b text-[10px] tracking-[0.12em] uppercase">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Student</th>
                      <th className="px-4 py-3 font-semibold">Course</th>
                      <th className="px-4 py-3 font-semibold">Version</th>
                      <th className="px-4 py-3 font-semibold">Published</th>
                      <th className="px-4 py-3 font-semibold">Anchor</th>
                      <th className="px-6 py-3 text-right font-semibold">
                        Correction
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {records.map((record) => (
                      <tr key={record.grade_record_id}>
                        <td className="px-6 py-4 font-medium">
                          {record.studentDisplayName}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium">
                            {record.course_code} · {record.grade_code}
                          </p>
                          <p className="text-muted-foreground mt-1 text-xs">
                            {record.course_title}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <Badge
                            variant="outline"
                            className="rounded-sm text-[10px]"
                          >
                            v{record.version_number} · Current
                          </Badge>
                        </td>
                        <td className="text-muted-foreground px-4 py-4 text-xs">
                          {formatDate(record.published_at)}
                        </td>
                        <td className="px-4 py-4">
                          <Badge
                            variant="outline"
                            className="rounded-sm text-[10px]"
                          >
                            {record.anchor_status?.replaceAll("_", " ") ??
                              "Not configured"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <label
                              className="sr-only"
                              htmlFor={record.grade_record_id}
                            >
                              Correction reason for {record.course_code}
                            </label>
                            <select
                              id={record.grade_record_id}
                              value={
                                reasonByRecord[record.grade_record_id] ??
                                "clerical_error"
                              }
                              onChange={(event) =>
                                setReasonByRecord((current) => ({
                                  ...current,
                                  [record.grade_record_id]: event.target
                                    .value as CorrectionReason,
                                }))
                              }
                              className="border-input h-8 rounded-sm border bg-white px-2 text-xs"
                            >
                              <option value="clerical_error">
                                Clerical error
                              </option>
                              <option value="calculation_error">
                                Calculation error
                              </option>
                              <option value="incomplete_resolved">
                                Incomplete resolved
                              </option>
                              <option value="appeal_outcome">
                                Appeal outcome
                              </option>
                              <option value="other_documented">
                                Other documented
                              </option>
                            </select>
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-sm"
                              disabled={pending}
                              onClick={() =>
                                run(record.grade_record_id, () =>
                                  startRegistrarGradeCorrection({
                                    gradeRecordId: record.grade_record_id,
                                    reasonCode:
                                      reasonByRecord[record.grade_record_id] ??
                                      "clerical_error",
                                  }),
                                )
                              }
                            >
                              <RefreshCcw aria-hidden="true" />
                              Start
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-muted-foreground p-10 text-center text-sm">
                No published synthetic records are available.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <div
        aria-live="polite"
        className="text-lozzi-slate flex min-h-5 items-center gap-2 text-xs"
      >
        {feedback ? (
          <>
            <AlertTriangle className="size-4" aria-hidden="true" />
            {feedback}
          </>
        ) : null}
      </div>
    </div>
  );
}
