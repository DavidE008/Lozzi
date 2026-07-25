import { FileCheck2 } from "lucide-react";
import { redirect } from "next/navigation";

import { RegistrarPageHeading } from "@/components/registrar/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAuthenticatedUser } from "@/lib/auth";
import { getRegistrarWorkspaceForUser } from "@/lib/repositories/registrar";

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "Not submitted";

export default async function RegistrarRecordsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  const workspace = await getRegistrarWorkspaceForUser(user.id);
  if (!workspace) redirect("/onboarding");

  return (
    <>
      <RegistrarPageHeading
        eyebrow="Academic records"
        title="Publication queue"
        description="Inspect approved synthetic submissions. Publishing, correction chains, and onchain anchoring remain explicitly unavailable until Milestone 4 and later."
        action={
          <Button disabled title="Record publication begins in Milestone 4">
            <FileCheck2 aria-hidden="true" />
            Publish selected
          </Button>
        }
      />
      <Card className="gap-0 overflow-hidden py-0 shadow-none">
        <CardContent className="p-0">
          {workspace.attentionItems.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left">
                <thead className="bg-muted/35 text-muted-foreground border-b text-[10px] tracking-[0.12em] uppercase">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Course</th>
                    <th className="px-4 py-3 font-semibold">Submitted by</th>
                    <th className="px-4 py-3 font-semibold">Submitted</th>
                    <th className="px-6 py-3 text-right font-semibold">
                      State
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
                          {item.recordType} · Version {item.versionNumber}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-medium">{item.courseCode}</p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {item.courseTitle}
                        </p>
                      </td>
                      <td className="text-muted-foreground px-4 py-4 text-sm">
                        {item.submittedByDisplayName}
                      </td>
                      <td className="text-muted-foreground px-4 py-4 text-sm">
                        {formatDate(item.submittedAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Badge
                          variant="outline"
                          className="border-lozzi-gold/30 bg-lozzi-gold/5 text-lozzi-slate text-[10px] capitalize"
                        >
                          {item.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-14 text-center">
              <FileCheck2
                className="text-muted-foreground/35 mx-auto size-9"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-semibold">The queue is clear</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Submitted or approved records will appear here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
