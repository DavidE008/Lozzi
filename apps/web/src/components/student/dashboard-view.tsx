import type { StudentDashboard } from "@lozzi/domain";
import {
  ArrowUpRight,
  BookMarked,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

export function DashboardView({
  dashboard,
}: {
  readonly dashboard: StudentDashboard;
}) {
  const metrics = [
    {
      label: "Program",
      value: dashboard.programName,
      detail: "Undergraduate",
      icon: GraduationCap,
    },
    {
      label: "Cumulative GPA",
      value: dashboard.gpa.toFixed(2),
      detail: "In good standing",
      icon: BookMarked,
    },
    {
      label: "Credits earned",
      value: `${dashboard.creditsEarned}`,
      detail: `of ${dashboard.creditsRequired} required`,
      icon: CheckCircle2,
    },
    {
      label: "Active holds",
      value: `${dashboard.activeHolds}`,
      detail:
        dashboard.activeHolds === 0 ? "Clear to register" : "Action required",
      icon: ShieldCheck,
    },
  ] as const;

  return (
    <>
      <section className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-lozzi-teal text-xs font-semibold tracking-[0.18em] uppercase">
            Student overview
          </p>
          <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Welcome back, {dashboard.displayName.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground mt-2">
            Here is where your academic journey stands today.
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-lozzi-teal/30 bg-lozzi-teal/5 text-lozzi-teal w-fit gap-2 px-3 py-1.5"
        >
          <span
            className="bg-lozzi-teal size-1.5 rounded-full"
            aria-hidden="true"
          />
          {dashboard.academicStanding === "active"
            ? "Good academic standing"
            : dashboard.academicStanding}
        </Badge>
      </section>

      <section
        aria-label="Academic summary"
        className="bg-border grid gap-px overflow-hidden rounded-sm border sm:grid-cols-2 xl:grid-cols-4"
      >
        {metrics.map(({ label, value, detail, icon: Icon }) => (
          <div key={label} className="bg-card min-h-36 p-5">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                {label}
              </p>
              <Icon className="text-lozzi-teal size-4" aria-hidden="true" />
            </div>
            <p
              className={cn(
                "font-heading text-3xl font-semibold",
                label === "Program" && "text-2xl",
              )}
            >
              {value}
            </p>
            <p className="text-muted-foreground mt-2 text-xs">{detail}</p>
          </div>
        ))}
      </section>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.75fr)]">
        <Card className="gap-0 overflow-hidden py-0 shadow-none">
          <CardHeader className="flex-row items-center justify-between border-b px-6 py-5">
            <div>
              <CardTitle className="font-heading text-xl">
                Current courses
              </CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Fall 2026 · Enrolled
              </p>
            </div>
            <Badge variant="secondary">
              {dashboard.currentCourses.length} course
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {dashboard.currentCourses.length ? (
              <ul className="divide-y">
                {dashboard.currentCourses.map((course) => (
                  <li key={`${course.code}-${course.section}`} className="p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-lozzi-teal text-xs font-semibold tracking-wider uppercase">
                            {course.code}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            Section {course.section}
                          </span>
                        </div>
                        <h2 className="font-heading mt-2 text-xl font-semibold">
                          {course.title}
                        </h2>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {course.instructor}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={<Link href="/student/record" />}
                      >
                        Details <ArrowUpRight aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="text-muted-foreground mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t pt-4 text-xs">
                      <span className="flex items-center gap-2">
                        <CalendarDays className="size-3.5" aria-hidden="true" />
                        {course.schedule}
                      </span>
                      <span className="flex items-center gap-2">
                        <MapPin className="size-3.5" aria-hidden="true" />
                        {course.location}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-10 text-center">
                <BookMarked
                  className="text-muted-foreground/40 mx-auto size-8"
                  aria-hidden="true"
                />
                <p className="mt-3 font-medium">No current courses</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Enrolled courses will appear here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="font-heading text-xl">
                Degree progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <span className="font-heading text-4xl font-semibold">
                  {dashboard.progressPercent}%
                </span>
                <span className="text-muted-foreground text-xs">
                  {dashboard.creditsEarned}/{dashboard.creditsRequired} credits
                </span>
              </div>
              <Progress
                value={dashboard.progressPercent}
                aria-label={`${dashboard.progressPercent}% degree progress`}
                className="mt-4 h-2"
              />
              <Button
                variant="link"
                className="text-lozzi-teal mt-4 h-auto p-0"
                nativeButton={false}
                render={<Link href="/student/progress" />}
              >
                View degree audit <ArrowUpRight aria-hidden="true" />
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="font-heading text-xl">
                Recent activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard.recentActivity.length ? (
                <ol className="space-y-5">
                  {dashboard.recentActivity.map((activity) => (
                    <li key={activity.id} className="flex gap-3">
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          activity.tone === "gold"
                            ? "bg-lozzi-gold"
                            : activity.tone === "slate"
                              ? "bg-lozzi-slate"
                              : "bg-lozzi-teal",
                        )}
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-sm font-medium">{activity.title}</p>
                        <p className="text-muted-foreground mt-0.5 text-xs leading-5">
                          {activity.detail}
                        </p>
                        <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-[11px]">
                          <Clock3 className="size-3" aria-hidden="true" />
                          {formatDate(activity.occurredAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No recent academic activity.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
