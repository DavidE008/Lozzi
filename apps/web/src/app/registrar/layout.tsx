import { hasRegistrarAccess, roleHomePath } from "@lozzi/domain";
import { redirect } from "next/navigation";

import { RegistrarShell } from "@/components/registrar/registrar-shell";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getInstitutionAccessForUser,
  getProfileForUser,
} from "@/lib/repositories/access";
import { getRegistrarWorkspaceForUser } from "@/lib/repositories/registrar";

export default async function RegistrarLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");

  const [access, profile, workspace] = await Promise.all([
    getInstitutionAccessForUser(user.id),
    getProfileForUser(user.id),
    getRegistrarWorkspaceForUser(user.id),
  ]);

  if (!access || !hasRegistrarAccess(access.roles)) {
    redirect(roleHomePath(access?.roles ?? []));
  }
  if (!workspace) redirect("/onboarding");

  return (
    <RegistrarShell
      displayName={profile?.displayName ?? "Registrar"}
      initials={profile?.initials ?? "RG"}
      institutionName={workspace.institutionName}
      termName={workspace.termName ?? "No active term"}
      roleLabel={
        access.roles.includes("institution_admin")
          ? "Institution administrator"
          : "Registrar"
      }
    >
      {children}
    </RegistrarShell>
  );
}
