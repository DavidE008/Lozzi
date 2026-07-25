import { redirect } from "next/navigation";

import { GradeEntryWorkspace } from "@/components/instructor/grade-entry-workspace";
import { getInstructorGradebook } from "@/lib/repositories/grades";

export default async function InstructorGradeEntryPage({
  params,
}: {
  readonly params: Promise<{ readonly sectionId: string }>;
}) {
  const { sectionId } = await params;
  const gradebook = await getInstructorGradebook(sectionId);
  if (!gradebook) redirect("/instructor");

  return <GradeEntryWorkspace gradebook={gradebook} />;
}
