import { redirect } from "next/navigation";

import { DashboardView } from "@/components/student/dashboard-view";
import { getAuthenticatedUser } from "@/lib/auth";
import { getDashboardForUser } from "@/lib/repositories/student";

export default async function StudentDashboardPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  const dashboard = await getDashboardForUser(user.id);
  if (!dashboard) redirect("/onboarding");

  return <DashboardView dashboard={dashboard} />;
}
