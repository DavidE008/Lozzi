import { redirect } from "next/navigation";

import { StudentShell } from "@/components/student/student-shell";
import { getAuthenticatedUser } from "@/lib/auth";
import { getDashboardForUser } from "@/lib/repositories/student";

export default async function StudentLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/auth");
  }

  const dashboard = await getDashboardForUser(user.id);
  if (!dashboard) {
    redirect("/onboarding");
  }

  return (
    <StudentShell
      displayName={dashboard.displayName}
      initials={dashboard.initials}
      institutionName={dashboard.institutionName}
    >
      {children}
    </StudentShell>
  );
}
