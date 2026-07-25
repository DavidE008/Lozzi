import { roleHomePath } from "@lozzi/domain";
import { redirect } from "next/navigation";

import { InstructorShell } from "@/components/instructor/instructor-shell";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getInstitutionAccessForUser,
  getProfileForUser,
} from "@/lib/repositories/access";
import { getInstructorSections } from "@/lib/repositories/grades";

export default async function InstructorLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");

  const [access, profile, sections] = await Promise.all([
    getInstitutionAccessForUser(user.id),
    getProfileForUser(user.id),
    getInstructorSections(),
  ]);

  if (!access?.roles.includes("instructor")) {
    redirect(roleHomePath(access?.roles ?? []));
  }

  const currentTermName =
    sections.find(({ section_status }) => section_status === "open")
      ?.term_name ?? sections[0]?.term_name;

  return (
    <InstructorShell
      displayName={profile?.displayName ?? "Instructor"}
      institutionName={access.institutionName}
      termName={currentTermName ?? "No assigned term"}
    >
      {children}
    </InstructorShell>
  );
}
