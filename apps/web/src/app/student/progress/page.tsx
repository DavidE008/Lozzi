import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeading } from "@/components/student/page-heading";
import { getAuthenticatedUser } from "@/lib/auth";
import { getDashboardForUser } from "@/lib/repositories/student";

export default async function DegreeProgressPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  const dashboard = await getDashboardForUser(user.id);
  if (!dashboard) redirect("/onboarding");

  return (
    <>
      <PageHeading
        eyebrow="Degree audit"
        title="Degree progress"
        description={`Your current progress toward the ${dashboard.programName} program.`}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Overall completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <span className="font-heading text-5xl font-semibold">{dashboard.progressPercent}%</span>
              <span className="text-sm text-muted-foreground">
                {dashboard.creditsEarned} of {dashboard.creditsRequired} credits
              </span>
            </div>
            <Progress value={dashboard.progressPercent} className="mt-6 h-3" />
            <div className="mt-8 grid gap-px overflow-hidden rounded-sm border bg-border sm:grid-cols-2">
              <div className="bg-card p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Completed</p>
                <p className="mt-2 font-heading text-2xl font-semibold">{dashboard.creditsEarned} credits</p>
              </div>
              <div className="bg-card p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Remaining</p>
                <p className="mt-2 font-heading text-2xl font-semibold">
                  {dashboard.creditsRequired - dashboard.creditsEarned} credits
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="h-fit border-lozzi-gold/30 bg-lozzi-gold/5 shadow-none">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Planning note</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Degree audits are advisory. Your registrar confirms final graduation eligibility.
          </CardContent>
        </Card>
      </div>
    </>
  );
}
