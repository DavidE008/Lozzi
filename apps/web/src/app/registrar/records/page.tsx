import { FileCheck2 } from "lucide-react";
import { redirect } from "next/navigation";

import { GradePublicationManager } from "@/components/registrar/grade-publication-manager";
import { RegistrarPageHeading } from "@/components/registrar/page-heading";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getRegistrarGradeQueue,
  getStudentAcademicRecords,
} from "@/lib/repositories/grades";
import {
  getRegistrarStudents,
  getRegistrarWorkspaceForUser,
} from "@/lib/repositories/registrar";

export default async function RegistrarRecordsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  const workspace = await getRegistrarWorkspaceForUser(user.id);
  if (!workspace) redirect("/onboarding");

  const [queue, students] = await Promise.all([
    getRegistrarGradeQueue(workspace.institutionId),
    getRegistrarStudents(workspace.institutionId),
  ]);
  const records = (
    await Promise.all(
      students.map(async (student) => ({
        student,
        records: await getStudentAcademicRecords(student.id),
      })),
    )
  ).flatMap(({ student, records: studentRecords }) =>
    studentRecords
      .filter(({ is_current }) => is_current)
      .map((record) => ({
        ...record,
        studentDisplayName: student.displayName,
      })),
  );

  return (
    <>
      <RegistrarPageHeading
        eyebrow="Academic records"
        title="Publication queue"
        description="Approve instructor submissions, publish official outcomes, and start auditable correction chains. Grade values remain private and offchain."
        action={
          <FileCheck2 className="text-lozzi-teal size-6" aria-hidden="true" />
        }
      />
      <GradePublicationManager queue={queue} records={records} />
    </>
  );
}
