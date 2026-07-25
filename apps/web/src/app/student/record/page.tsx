import { History, Link2Off, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeading } from "@/components/student/page-heading";
import { getAuthenticatedUser } from "@/lib/auth";
import { getStudentAcademicRecords } from "@/lib/repositories/grades";
import { getDashboardForUser } from "@/lib/repositories/student";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    new Date(value),
  );

export default async function AcademicRecordPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  const dashboard = await getDashboardForUser(user.id);
  if (!dashboard) redirect("/onboarding");
  const records = await getStudentAcademicRecords(dashboard.studentId);
  const currentRecords = records.filter(({ is_current }) => is_current);
  const historicalRecords = records.filter(({ is_current }) => !is_current);

  return (
    <>
      <PageHeading
        eyebrow="Official history"
        title="Academic record"
        description="Published outcomes from your official academic history. Draft and submitted grades never appear here."
      />
      <Card className="gap-0 overflow-hidden rounded-sm py-0 shadow-none">
        <CardContent className="p-0">
          {currentRecords.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-left text-sm">
                <thead className="bg-muted/40 text-muted-foreground border-b text-[10px] tracking-[0.14em] uppercase">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Course</th>
                    <th className="px-5 py-4 font-semibold">Term</th>
                    <th className="px-5 py-4 font-semibold">Credits</th>
                    <th className="px-5 py-4 font-semibold">Grade</th>
                    <th className="px-5 py-4 font-semibold">Record</th>
                    <th className="px-6 py-4 font-semibold">Onchain anchor</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {currentRecords.map((record) => (
                    <tr key={record.grade_record_id}>
                      <td className="px-6 py-5">
                        <p className="font-medium">{record.course_code}</p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {record.course_title}
                        </p>
                      </td>
                      <td className="text-muted-foreground px-5 py-5">
                        {record.term_name}
                      </td>
                      <td className="px-5 py-5">
                        {record.credit_hours_earned} earned
                      </td>
                      <td className="font-heading px-5 py-5 text-xl font-semibold">
                        {record.grade_code}
                      </td>
                      <td className="px-5 py-5">
                        <Badge className="bg-lozzi-teal/10 text-lozzi-teal hover:bg-lozzi-teal/10 rounded-sm">
                          <ShieldCheck aria-hidden="true" />
                          Official · v{record.version_number}
                        </Badge>
                        <p className="text-muted-foreground mt-2 text-[11px]">
                          Published {formatDate(record.published_at)}
                        </p>
                      </td>
                      <td className="px-6 py-5">
                        <Badge
                          variant="outline"
                          className="text-muted-foreground rounded-sm"
                        >
                          <Link2Off aria-hidden="true" />
                          {record.anchor_status?.replaceAll("_", " ") ??
                            "Not configured"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-muted-foreground p-12 text-center text-sm">
              No published academic records yet.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-7 rounded-sm shadow-none">
        <CardHeader className="border-b">
          <div className="flex items-center gap-3">
            <History className="text-lozzi-teal size-5" aria-hidden="true" />
            <div>
              <CardTitle className="font-heading text-xl">
                Correction history
              </CardTitle>
              <p className="text-muted-foreground mt-1 text-xs">
                Superseded versions remain visible for a complete audit trail.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {historicalRecords.length ? (
            <ul className="divide-y" aria-label="Superseded record versions">
              {historicalRecords.map((record) => (
                <li
                  key={record.grade_record_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {record.course_code} · {record.course_title}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Version {record.version_number} · {record.grade_code} ·{" "}
                      {record.correction_reason_code?.replaceAll("_", " ") ??
                        "Original publication"}
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-sm">
                    Superseded{" "}
                    {formatDate(record.superseded_at ?? record.published_at)}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              No corrections have been published.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
