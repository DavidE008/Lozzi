import { parseEnvironment } from "@lozzi/domain";
import { Clock3, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { SensitiveShareWizard } from "@/components/student/sensitive-share-wizard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeading } from "@/components/student/page-heading";
import { getAuthenticatedUser } from "@/lib/auth";
import { getDashboardForUser, getShareRows } from "@/lib/repositories/student";

export default async function SharesPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  const dashboard = await getDashboardForUser(user.id);
  if (!dashboard) redirect("/onboarding");
  const shares = await getShareRows(dashboard.studentId);
  const worldCapability = parseEnvironment(process.env).capabilities.find(
    ({ name }) => name === "world",
  )!;

  return (
    <>
      <PageHeading
        eyebrow="Consent and access"
        title="Verified shares"
        description="Review synthetic record-sharing grants and their current access state."
      />
      <SensitiveShareWizard worldCapability={worldCapability} />
      <div className="space-y-3">
        {shares.length ? (
          shares.map((share) => {
            const expired = new Date(share.expires_at) <= new Date();
            const active =
              share.status === "active" && !share.revoked_at && !expired;
            return (
              <Card key={share.id} className="shadow-none">
                <CardContent className="flex flex-col gap-4 py-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-4">
                    <span className="bg-lozzi-teal/10 text-lozzi-teal flex size-10 shrink-0 items-center justify-center rounded-sm">
                      <ShieldCheck className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="font-medium">{share.recipient_label}</h2>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Scope: {share.scopes.join(", ")}
                      </p>
                      <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
                        <Clock3 className="size-3" aria-hidden="true" />
                        Expires{" "}
                        {new Intl.DateTimeFormat("en", {
                          dateStyle: "medium",
                        }).format(new Date(share.expires_at))}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      active
                        ? "border-lozzi-teal/30 bg-lozzi-teal/5 text-lozzi-teal"
                        : "border-muted-foreground/20 text-muted-foreground"
                    }
                  >
                    {active
                      ? "Active"
                      : share.revoked_at
                        ? "Revoked"
                        : "Expired"}
                  </Badge>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="shadow-none">
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              You have not created any record shares.
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
