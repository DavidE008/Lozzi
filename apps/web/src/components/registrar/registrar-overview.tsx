import type { RegistrarWorkspace } from "@lozzi/domain";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  FileCheck2,
  GraduationCap,
  Users,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const formatDate = (value: string | null, withYear = false) => {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(new Date(value));
};

const actionLabel = (action: string) =>
  action
    .replace(".", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export function RegistrarOverview({
  workspace,
}: {
  readonly workspace: RegistrarWorkspace;
}) {
  const metrics = [
    {
      label: "Registration",
      value: workspace.termStatus === "registration_open" ? "Open" : "Not open",
      detail: `Closes ${formatDate(workspace.registrationClosesAt)}`,
      icon: CalendarClock,
      accent: true,
    },
    {
      label: "Active students",
      value: workspace.activeStudentCount.toLocaleString("en-GB"),
      detail: "Institution-wide",
      icon: Users,
    },
    {
      label: "Course sections",
      value: workspace.courseSectionCount.toLocaleString("en-GB"),
      detail: "Across seeded terms",
      icon: GraduationCap,
    },
    {
      label: "Records awaiting publication",
      value: workspace.recordsAwaitingPublication.toLocaleString("en-GB"),
      detail: "Ready for registrar review",
      icon: FileCheck2,
    },
  ] as const;

  return (
    <>
      <section className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-[2.15rem]">
            Registrar workspace
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Oversee academic records and manage registration operations.
          </p>
        </div>
        <Button
          nativeButton={false}
          render={<Link href="/registrar/records" />}
        >
          <FileCheck2 aria-hidden="true" />
          Publish record
        </Button>
      </section>

      <section
        aria-label="Registrar summary"
        className="bg-border grid overflow-hidden rounded-sm border sm:grid-cols-2 xl:grid-cols-4"
      >
        {metrics.map(({ label, value, detail, icon: Icon, ...metric }) => (
          <div
            key={label}
            className="bg-card min-h-32 border-b p-5 last:border-b-0 sm:border-r xl:border-b-0 sm:[&:nth-child(2)]:border-r-0 xl:[&:nth-child(2)]:border-r"
          >
            <div className="flex items-start justify-between">
              <p className="text-muted-foreground max-w-40 text-[10px] font-semibold tracking-[0.13em] uppercase">
                {label}
              </p>
              <Icon className="text-lozzi-teal size-4" aria-hidden="true" />
            </div>
            <div className="mt-5 flex items-baseline gap-2">
              <p className="font-heading text-3xl font-semibold">{value}</p>
              {"accent" in metric ? (
                <span className="bg-lozzi-teal size-1.5 rounded-full" />
              ) : null}
            </div>
            <p className="text-muted-foreground mt-1.5 text-xs">{detail}</p>
          </div>
        ))}
      </section>

      <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1.65fr)_minmax(19rem,0.75fr)]">
        <Card className="gap-0 overflow-hidden py-0 shadow-none">
          <CardHeader className="flex-row items-center justify-between border-b px-5 py-4 sm:px-6">
            <div>
              <CardTitle className="font-heading text-xl">
                Records requiring attention
              </CardTitle>
              <p className="text-muted-foreground mt-1 text-xs">
                Submitted and approved outcomes ready for registrar action.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/registrar/records" />}
            >
              View all <ArrowRight aria-hidden="true" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {workspace.attentionItems.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[44rem] text-left">
                  <thead className="bg-muted/35 text-muted-foreground border-b text-[10px] tracking-[0.12em] uppercase">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Student</th>
                      <th className="px-4 py-3 font-semibold">Record</th>
                      <th className="px-4 py-3 font-semibold">Submitted by</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 text-right font-semibold">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {workspace.attentionItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold">
                            {item.studentDisplayName}
                          </p>
                          <p className="text-muted-foreground mt-0.5 text-[11px]">
                            Version {item.versionNumber}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium">
                            {item.recordType}
                          </p>
                          <p className="text-muted-foreground mt-0.5 text-[11px]">
                            {item.courseCode} · {item.courseTitle}
                          </p>
                        </td>
                        <td className="text-muted-foreground px-4 py-4 text-sm">
                          {item.submittedByDisplayName}
                        </td>
                        <td className="px-4 py-4">
                          <Badge
                            variant="outline"
                            className="border-lozzi-gold/30 bg-lozzi-gold/5 text-lozzi-slate text-[10px] capitalize"
                          >
                            {item.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            nativeButton={false}
                            render={<Link href="/registrar/records" />}
                          >
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <BookOpenCheck
                  className="text-muted-foreground/35 mx-auto size-8"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-semibold">
                  No records need attention
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Submitted and approved grade records will appear here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="font-heading text-xl">
              Academic term
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-b pb-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-heading text-2xl font-semibold">
                  {workspace.termName ?? "No active term"}
                </p>
                <Badge className="bg-lozzi-teal/10 text-lozzi-teal hover:bg-lozzi-teal/10">
                  {workspace.termStatus === "registration_open"
                    ? "Registration open"
                    : (workspace.termStatus ?? "Not scheduled")}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-2 text-xs">
                {formatDate(workspace.startsOn, true)} –{" "}
                {formatDate(workspace.endsOn, true)}
              </p>
            </div>
            <dl className="space-y-4 pt-5 text-sm">
              <div className="flex justify-between gap-6">
                <dt className="text-muted-foreground">Registration closes</dt>
                <dd className="font-medium">
                  {formatDate(workspace.registrationClosesAt)}
                </dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-muted-foreground">Add/drop deadline</dt>
                <dd className="font-medium">
                  {formatDate(workspace.addDropDeadline)}
                </dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-muted-foreground">Withdrawal deadline</dt>
                <dd className="font-medium">
                  {formatDate(workspace.withdrawalDeadline)}
                </dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-muted-foreground">Grades due</dt>
                <dd className="font-medium">
                  {formatDate(workspace.gradesDueAt)}
                </dd>
              </div>
            </dl>
            <Button
              variant="outline"
              className="mt-6 w-full"
              nativeButton={false}
              render={<Link href="/registrar/terms" />}
            >
              Manage term
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-7 gap-0 overflow-hidden py-0 shadow-none">
        <CardHeader className="flex-row items-center justify-between border-b px-5 py-4 sm:px-6">
          <CardTitle className="font-heading text-xl">
            Institution activity
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/registrar/audit" />}
          >
            Audit log <ArrowRight aria-hidden="true" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {workspace.recentActivity.length ? (
            <ul className="divide-y">
              {workspace.recentActivity.map((item) => (
                <li
                  key={item.id}
                  className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[1fr_auto] sm:px-6"
                >
                  <div>
                    <p className="font-medium">{actionLabel(item.action)}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {item.actorDisplayName} ·{" "}
                      {item.actorRole.replace("_", " ")}
                    </p>
                  </div>
                  <time className="text-muted-foreground text-xs">
                    {formatDate(item.occurredAt, true)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-muted-foreground px-6 py-9 text-center text-sm">
              Audited catalog and term changes will appear here.
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
