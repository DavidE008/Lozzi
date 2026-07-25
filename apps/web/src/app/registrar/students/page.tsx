import { Search, Users } from "lucide-react";
import { redirect } from "next/navigation";

import { RegistrarPageHeading } from "@/components/registrar/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getRegistrarWorkspaceForUser,
  getRegistrarStudents,
} from "@/lib/repositories/registrar";

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "Not set";

export default async function RegistrarStudentsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  const workspace = await getRegistrarWorkspaceForUser(user.id);
  if (!workspace) redirect("/onboarding");
  const students = await getRegistrarStudents(workspace.institutionId);

  return (
    <>
      <RegistrarPageHeading
        eyebrow="People"
        title="Students"
        description="Review the institution-scoped student directory and programme assignments. Student lifecycle mutations begin in a later milestone."
      />
      <Card className="gap-0 overflow-hidden py-0 shadow-none">
        <div className="flex items-center justify-between border-b px-5 py-4 sm:px-6">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Users className="text-lozzi-teal size-4" aria-hidden="true" />
            {students.length} synthetic students
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Search className="size-3.5" aria-hidden="true" />
            Read-only directory
          </div>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left">
              <thead className="bg-muted/35 text-muted-foreground border-b text-[10px] tracking-[0.12em] uppercase">
                <tr>
                  <th className="px-6 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Student ID</th>
                  <th className="px-4 py-3 font-semibold">Programme</th>
                  <th className="px-4 py-3 font-semibold">
                    Expected completion
                  </th>
                  <th className="px-6 py-3 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {students.map((student) => (
                  <tr key={student.id}>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold">
                        {student.displayName}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-[11px]">
                        Synthetic record
                      </p>
                    </td>
                    <td className="text-muted-foreground px-4 py-4 font-mono text-xs">
                      {student.studentNumber}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {student.programName ?? "Not declared"}
                      {student.programVersionNumber ? (
                        <span className="text-muted-foreground ml-1 text-xs">
                          v{student.programVersionNumber}
                        </span>
                      ) : null}
                    </td>
                    <td className="text-muted-foreground px-4 py-4 text-sm">
                      {formatDate(student.expectedCompletionDate)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Badge
                        variant="outline"
                        className="border-lozzi-teal/25 bg-lozzi-teal/5 text-lozzi-teal text-[10px] capitalize"
                      >
                        {student.academicStatus}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
