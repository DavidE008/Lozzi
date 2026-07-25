import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeading } from "@/components/student/page-heading";
import { getAuthenticatedUser } from "@/lib/auth";
import { getDashboardForUser, getRecordRows } from "@/lib/repositories/student";

export default async function AcademicRecordPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  const dashboard = await getDashboardForUser(user.id);
  if (!dashboard) redirect("/onboarding");
  const records = await getRecordRows(dashboard.studentId);

  return (
    <>
      <PageHeading
        eyebrow="Verified history"
        title="Academic record"
        description="Published outcomes from your official academic history. Draft grades never appear here."
      />
      <Card className="py-0 shadow-none">
        <CardContent className="p-0">
          {records.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4 font-medium">Course</th>
                    <th className="px-6 py-4 font-medium">Credits</th>
                    <th className="px-6 py-4 font-medium">Grade</th>
                    <th className="px-6 py-4 font-medium">Published</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {records.map((record) => {
                    const section = record.enrollments.course_sections;
                    return (
                      <tr key={record.id}>
                        <td className="px-6 py-5">
                          <p className="font-medium">{section.courses.code}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{section.courses.title}</p>
                        </td>
                        <td className="px-6 py-5">{record.credit_hours_earned}</td>
                        <td className="px-6 py-5 font-heading text-lg font-semibold">{record.grade_code}</td>
                        <td className="px-6 py-5 text-muted-foreground">
                          {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                            new Date(record.published_at),
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <Badge className="bg-lozzi-teal/10 text-lozzi-teal hover:bg-lozzi-teal/10">
                            Verified
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No published academic records yet.
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
