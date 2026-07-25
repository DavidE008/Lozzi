import { roleHomePath } from "@lozzi/domain";
import { redirect } from "next/navigation";

import { AdvisorShell } from "@/components/advisor/advisor-shell";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getInstitutionAccessForUser,
  getProfileForUser,
} from "@/lib/repositories/access";

export default async function AdvisorLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  const [access, profile] = await Promise.all([
    getInstitutionAccessForUser(user.id),
    getProfileForUser(user.id),
  ]);
  if (!access?.roles.includes("advisor")) {
    redirect(roleHomePath(access?.roles ?? []));
  }

  return (
    <AdvisorShell
      displayName={profile?.displayName ?? "Advisor"}
      institutionName={access.institutionName}
    >
      {children}
    </AdvisorShell>
  );
}
