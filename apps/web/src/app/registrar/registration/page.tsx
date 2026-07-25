import { CheckCircle2, ClipboardList, XCircle } from "lucide-react";
import { redirect } from "next/navigation";

import { RegistrarPageHeading } from "@/components/registrar/page-heading";
import { Badge } from "@/components/ui/badge";
import { getAuthenticatedUser } from "@/lib/auth";
import { getRegistrarWorkspaceForUser } from "@/lib/repositories/registrar";
import { getRegistrationOversight } from "@/lib/repositories/registration-oversight";

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export default async function RegistrarRegistrationPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  const workspace = await getRegistrarWorkspaceForUser(user.id);
  if (!workspace) redirect("/onboarding");
  const requests = await getRegistrationOversight(workspace.institutionId);

  return (
    <>
      <RegistrarPageHeading
        eyebrow="Registration oversight"
        title="Student registration activity"
        description="Review institution-scoped registration outcomes. Eligibility remains deterministic and student actions are append-only audited."
      />

      <section className="overflow-hidden border bg-white">
        <div className="text-muted-foreground bg-lozzi-ivory/70 hidden grid-cols-[1fr_9rem_7rem_10rem] gap-4 border-b px-5 py-3 text-[11px] font-semibold tracking-[0.12em] uppercase md:grid">
          <span>Student</span>
          <span>Term</span>
          <span>Outcome</span>
          <span className="text-right">Submitted</span>
        </div>
        {requests.length > 0 ? (
          <ol className="divide-y">
            {requests.map((request) => (
              <li
                key={request.id}
                className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_9rem_7rem_10rem] md:items-center"
              >
                <div className="flex items-center gap-3">
                  <span className="bg-lozzi-teal/8 flex size-8 items-center justify-center rounded-sm">
                    <ClipboardList
                      className="text-lozzi-teal size-4"
                      aria-hidden="true"
                    />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">
                      {request.studentDisplayName}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {request.sectionCount} section
                      {request.sectionCount === 1 ? "" : "s"} requested
                    </p>
                  </div>
                </div>
                <p className="text-sm">{request.termName}</p>
                <Badge
                  variant="outline"
                  className={
                    request.status === "accepted"
                      ? "w-fit border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "w-fit border-rose-200 bg-rose-50 text-rose-800"
                  }
                >
                  {request.status === "accepted" ? (
                    <CheckCircle2 aria-hidden="true" />
                  ) : (
                    <XCircle aria-hidden="true" />
                  )}
                  {request.status}
                </Badge>
                <time className="text-muted-foreground text-xs md:text-right">
                  {formatDateTime(request.createdAt)}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <div className="px-6 py-16 text-center">
            <ClipboardList className="text-muted-foreground/35 mx-auto size-9" />
            <p className="mt-3 text-sm font-semibold">
              No registration activity yet
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Student registration and withdrawal outcomes will appear here.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
