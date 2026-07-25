import { parseEnvironment } from "@lozzi/domain";
import { CheckCircle2, Circle, Clock3 } from "lucide-react";
import { redirect } from "next/navigation";

import { PageHeading } from "@/components/student/page-heading";
import { ProgressExplanationCard } from "@/components/student/progress-explanation-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getAuthenticatedUser } from "@/lib/auth";
import { getStudentDegreeProgress } from "@/lib/repositories/grades";
import { getDashboardForUser } from "@/lib/repositories/student";
import { cn } from "@/lib/utils";

const statusDetails = {
  complete: {
    label: "Complete",
    icon: CheckCircle2,
    className: "text-lozzi-teal",
  },
  "in-progress": {
    label: "In progress",
    icon: Clock3,
    className: "text-lozzi-gold",
  },
  remaining: {
    label: "Remaining",
    icon: Circle,
    className: "text-muted-foreground",
  },
} as const;

export default async function DegreeProgressPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  const dashboard = await getDashboardForUser(user.id);
  if (!dashboard) redirect("/onboarding");
  const progress = await getStudentDegreeProgress(dashboard.studentId);
  const zeroGCapability = parseEnvironment(process.env).capabilities.find(
    ({ name }) => name === "zero-g",
  )!;

  if (!progress) {
    return (
      <>
        <PageHeading
          eyebrow="Degree audit"
          title="Degree progress"
          description={`Your current progress toward the ${dashboard.programName} program.`}
        />
        <Card className="rounded-sm p-12 text-center shadow-none">
          <p className="text-sm font-semibold">
            Your degree audit is not available yet.
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            Published records will refresh this view automatically.
          </p>
        </Card>
      </>
    );
  }

  const requirementGroups = Object.groupBy(
    progress.requirement_results,
    ({ group }) => group,
  );

  return (
    <>
      <PageHeading
        eyebrow="Degree audit"
        title="Degree progress"
        description={`Your current progress toward the ${progress.program_name} program.`}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card className="rounded-sm shadow-none">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle className="font-heading text-xl">
                    Overall completion
                  </CardTitle>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Program version {progress.program_version}
                  </p>
                </div>
                <Badge variant="outline" className="rounded-sm">
                  GPA {progress.gpa?.toFixed(2) ?? "—"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <span className="font-heading text-5xl font-semibold">
                  {progress.progress_percent}%
                </span>
                <span className="text-muted-foreground text-sm">
                  {progress.credits_earned} of {progress.credits_required}{" "}
                  credits
                </span>
              </div>
              <Progress
                value={progress.progress_percent}
                className="mt-6 h-3"
              />
              <div className="bg-border mt-8 grid gap-px overflow-hidden rounded-sm border sm:grid-cols-3">
                <div className="bg-card p-5">
                  <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                    Completed
                  </p>
                  <p className="font-heading mt-2 text-2xl font-semibold">
                    {progress.credits_earned}
                  </p>
                </div>
                <div className="bg-card p-5">
                  <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                    Remaining
                  </p>
                  <p className="font-heading mt-2 text-2xl font-semibold">
                    {progress.credits_required - progress.credits_earned}
                  </p>
                </div>
                <div className="bg-card p-5">
                  <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                    Current GPA
                  </p>
                  <p className="font-heading mt-2 text-2xl font-semibold">
                    {progress.gpa?.toFixed(2) ?? "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {Object.entries(requirementGroups).map(([group, requirements]) => (
            <Card key={group} className="gap-0 rounded-sm py-0 shadow-none">
              <CardHeader className="border-b py-5">
                <CardTitle className="font-heading text-lg">{group}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {requirements?.map((requirement) => {
                    const details = statusDetails[requirement.status];
                    const Icon = details.icon;
                    return (
                      <li
                        key={requirement.requirementId ?? requirement.code}
                        className="flex items-center justify-between gap-4 px-6 py-4"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {requirement.code}
                            {requirement.title ? ` · ${requirement.title}` : ""}
                          </p>
                          {requirement.credits ? (
                            <p className="text-muted-foreground mt-1 text-xs">
                              {requirement.credits} credits
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={cn(
                            "flex items-center gap-2 text-xs font-medium",
                            details.className,
                          )}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                          {details.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <ProgressExplanationCard capability={zeroGCapability} />
          <Card className="h-fit rounded-sm shadow-none">
            <CardHeader>
              <CardTitle className="font-heading text-lg">
                Planning note
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm leading-6">
              Degree audits are advisory. Your registrar confirms final
              graduation eligibility. This snapshot updates only after an
              official record is published.
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
