import { parseEnvironment } from "@lozzi/domain";
import { redirect } from "next/navigation";

import { ShareHistoryList } from "@/components/student/share-history-list";
import { SensitiveShareWizard } from "@/components/student/sensitive-share-wizard";
import { PageHeading } from "@/components/student/page-heading";
import { getAuthenticatedUser } from "@/lib/auth";
import { getDashboardForUser, getShareRows } from "@/lib/repositories/student";

export default async function SharesPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  const dashboard = await getDashboardForUser(user.id);
  if (!dashboard) redirect("/onboarding");
  const shares = await getShareRows(dashboard.studentId);
  const worldCapability = parseEnvironment(process.env).capabilities.find(
    ({ name }) => name === "world",
  )!;

  return (
    <>
      <PageHeading
        eyebrow="Consent and access"
        title="Verified shares"
        description="Review synthetic record-sharing grants and their current access state."
      />
      <SensitiveShareWizard worldCapability={worldCapability} />
      <ShareHistoryList now={new Date().toISOString()} shares={shares} />
    </>
  );
}
