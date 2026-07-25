import { History } from "lucide-react";
import { redirect } from "next/navigation";

import { RegistrarPageHeading } from "@/components/registrar/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getRegistrarActivity,
  getRegistrarWorkspaceForUser,
} from "@/lib/repositories/registrar";

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const humanize = (value: string) =>
  value
    .replace(".", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default async function RegistrarAuditPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  const workspace = await getRegistrarWorkspaceForUser(user.id);
  if (!workspace) redirect("/onboarding");
  const activity = await getRegistrarActivity(workspace.institutionId);

  return (
    <>
      <RegistrarPageHeading
        eyebrow="Accountability"
        title="Institution audit"
        description="Review append-only, institution-scoped changes. Audit metadata is intentionally minimal and excludes student data."
      />
      <Card className="gap-0 overflow-hidden py-0 shadow-none">
        <CardContent className="p-0">
          {activity.length ? (
            <ol className="divide-y">
              {activity.map((item) => (
                <li
                  key={item.id}
                  className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6"
                >
                  <div className="flex min-w-0 gap-3">
                    <span className="bg-lozzi-teal/8 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-sm">
                      <History
                        className="text-lozzi-teal size-4"
                        aria-hidden="true"
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {humanize(item.action)}
                      </p>
                      <p className="text-muted-foreground mt-1 truncate text-xs">
                        {item.actorDisplayName} ·{" "}
                        {item.actorRole.replaceAll("_", " ")} ·{" "}
                        {item.entityType.replaceAll("_", " ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pl-11 sm:pl-0">
                    <Badge
                      variant="outline"
                      className="border-lozzi-teal/25 bg-lozzi-teal/5 text-lozzi-teal text-[10px] capitalize"
                    >
                      {item.outcome}
                    </Badge>
                    <time className="text-muted-foreground text-xs">
                      {formatDateTime(item.occurredAt)}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="px-6 py-14 text-center">
              <History
                className="text-muted-foreground/35 mx-auto size-9"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-semibold">
                No registrar activity yet
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Catalog, term, section, and settings changes will be recorded
                here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
