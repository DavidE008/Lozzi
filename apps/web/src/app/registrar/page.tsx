import { redirect } from "next/navigation";

import { RegistrarOverview } from "@/components/registrar/registrar-overview";
import { getAuthenticatedUser } from "@/lib/auth";
import { getRegistrarWorkspaceForUser } from "@/lib/repositories/registrar";

export default async function RegistrarOverviewPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");

  const workspace = await getRegistrarWorkspaceForUser(user.id);
  if (!workspace) redirect("/onboarding");

  return <RegistrarOverview workspace={workspace} />;
}
