import { parseEnvironment } from "@lozzi/domain";
import { redirect } from "next/navigation";

import { RegistrarPageHeading } from "@/components/registrar/page-heading";
import { SettingsManager } from "@/components/registrar/settings-manager";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthenticatedUser } from "@/lib/auth";
import { getInstitutionAccessForUser } from "@/lib/repositories/access";
import {
  getRegistrarMemberships,
  getRegistrarStaff,
} from "@/lib/repositories/registrar-administration";
import { getRegistrarWorkspaceForUser } from "@/lib/repositories/registrar";

const capabilityStatusLabel = {
  available: "Available",
  failed: "Unavailable",
  "mock-development": "Development mock",
  "not-configured": "Not configured",
} as const;

export default async function RegistrarSettingsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  const [access, workspace] = await Promise.all([
    getInstitutionAccessForUser(user.id),
    getRegistrarWorkspaceForUser(user.id),
  ]);
  if (!access || !workspace) redirect("/onboarding");
  const [memberships, staff] = await Promise.all([
    getRegistrarMemberships(workspace.institutionId),
    getRegistrarStaff(workspace.institutionId),
  ]);
  const { capabilities } = parseEnvironment(process.env);

  return (
    <>
      <RegistrarPageHeading
        eyebrow="Institution administration"
        title="Settings"
        description="Review database-derived memberships, scoped staff assignments, and the honest availability of optional partner capabilities."
      />
      <SettingsManager
        institutionId={workspace.institutionId}
        institutionName={workspace.institutionName}
        isInstitutionAdmin={access.roles.includes("institution_admin")}
        memberships={memberships}
        staff={staff}
      />
      <Card className="mt-7 shadow-none">
        <CardHeader>
          <CardTitle className="font-heading text-xl">
            Integration capability status
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-border grid gap-px overflow-hidden rounded-sm border sm:grid-cols-2 xl:grid-cols-3">
          {capabilities.map((capability) => (
            <div key={capability.name} className="bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{capability.label}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {capability.detail}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    capability.status === "available"
                      ? "border-lozzi-teal/30 text-lozzi-teal text-[10px]"
                      : "text-muted-foreground text-[10px]"
                  }
                >
                  {capabilityStatusLabel[capability.status]}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
