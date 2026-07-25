import { redirect } from "next/navigation";

import { getInstructorSections } from "@/lib/repositories/grades";

export default async function InstructorGradebookPage() {
  const sections = await getInstructorSections();
  const first = sections[0];
  if (first) {
    redirect(`/instructor/sections/${first.section_id}/grades`);
  }
  redirect("/instructor");
}
