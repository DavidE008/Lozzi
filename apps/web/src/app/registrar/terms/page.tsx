import { CalendarDays } from "lucide-react";
import { redirect } from "next/navigation";

import { RegistrarPageHeading } from "@/components/registrar/page-heading";
import { TermControls, TermManager } from "@/components/registrar/term-manager";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getAuthenticatedUser } from "@/lib/auth";
import { getRegistrarTerms } from "@/lib/repositories/registrar-administration";
import { getRegistrarWorkspaceForUser } from "@/lib/repositories/registrar";

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "Not scheduled";

export default async function RegistrarTermsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  const workspace = await getRegistrarWorkspaceForUser(user.id);
  if (!workspace) redirect("/onboarding");
  const terms = await getRegistrarTerms(workspace.institutionId);

  return (
    <>
      <RegistrarPageHeading
        eyebrow="Academic calendar"
        title="Terms"
        description="Configure term windows, credit limits, registration states, and institutional deadlines."
      />
      <TermManager institutionId={workspace.institutionId} />
      <div className="space-y-4">
        {terms.map((term) => (
          <Card
            key={term.id}
            className={
              term.deactivatedAt ? "opacity-60 shadow-none" : "shadow-none"
            }
          >
            <CardContent className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex gap-4">
                <span className="bg-lozzi-teal/8 flex size-10 shrink-0 items-center justify-center rounded-sm">
                  <CalendarDays
                    className="text-lozzi-teal size-5"
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-heading text-xl font-semibold">
                      {term.name}
                    </h2>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {term.status.replace("_", " ")}
                    </Badge>
                    {term.deactivatedAt ? (
                      <Badge variant="destructive" className="text-[10px]">
                        Deactivated
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {term.code} · {formatDate(term.startsOn)} –{" "}
                    {formatDate(term.endsOn)}
                  </p>
                  <dl className="mt-4 grid gap-x-8 gap-y-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <dt className="text-muted-foreground">
                        Registration closes
                      </dt>
                      <dd className="mt-0.5 font-medium">
                        {formatDate(term.registrationClosesAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Add/drop</dt>
                      <dd className="mt-0.5 font-medium">
                        {formatDate(term.addDropDeadline)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Withdrawal</dt>
                      <dd className="mt-0.5 font-medium">
                        {formatDate(term.withdrawalDeadline)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Credit range</dt>
                      <dd className="mt-0.5 font-medium">
                        {term.minCredits}–{term.maxCredits}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
              {!term.deactivatedAt ? (
                <TermControls
                  institutionId={workspace.institutionId}
                  id={term.id}
                  status={term.status}
                />
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
