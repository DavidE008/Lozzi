import { parseEnvironment } from "@lozzi/domain";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeading } from "@/components/student/page-heading";
import { getAuthenticatedUser } from "@/lib/auth";
import { getDashboardForUser } from "@/lib/repositories/student";

export default async function SettingsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  const dashboard = await getDashboardForUser(user.id);
  if (!dashboard) redirect("/onboarding");
  const { capabilities } = parseEnvironment(process.env);

  return (
    <>
      <PageHeading
        eyebrow="Preferences and integrations"
        title="Settings"
        description="Review your profile context and the honest availability of optional partner capabilities."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Student profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex justify-between border-b pb-3">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{dashboard.displayName}</span>
            </div>
            <div className="flex justify-between border-b pb-3">
              <span className="text-muted-foreground">Institution</span>
              <span className="font-medium">{dashboard.institutionName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Program</span>
              <span className="font-medium">{dashboard.programName}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Capability status</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {capabilities.map((capability) => (
              <div key={capability.name} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{capability.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{capability.detail}</p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    capability.status === "available"
                      ? "border-lozzi-teal/30 text-lozzi-teal"
                      : "text-muted-foreground"
                  }
                >
                  {capability.status === "available" ? "Available" : "Not configured"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
