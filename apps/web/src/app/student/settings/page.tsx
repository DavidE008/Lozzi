import { parseEnvironment } from "@lozzi/domain";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IdentitySetupCard } from "@/components/student/identity-setup-card";
import { PageHeading } from "@/components/student/page-heading";
import { getAuthenticatedUser } from "@/lib/auth";
import { isEnsWalletLinkConfigured } from "@/lib/integrations/config";
import {
  getStudentPartnerStatus,
  getVerifiedStudentWallet,
  hasVerifiedWorldAccount,
} from "@/lib/repositories/partner-status";
import { getDashboardForUser } from "@/lib/repositories/student";

export default async function SettingsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  const dashboard = await getDashboardForUser(user.id);
  if (!dashboard) redirect("/onboarding");
  const { capabilities } = parseEnvironment(process.env);
  const [partnerStatus, verifiedWallet] = await Promise.all([
    getStudentPartnerStatus(dashboard.studentId),
    getVerifiedStudentWallet(dashboard.studentId),
  ]);
  const worldCapability = capabilities.find(({ name }) => name === "world")!;
  const ensCapability = capabilities.find(({ name }) => name === "ens")!;
  const worldVerified = hasVerifiedWorldAccount(partnerStatus);

  return (
    <>
      <PageHeading
        eyebrow="Privacy-first identity"
        title="Identity & privacy"
        description="Set up one account-bound identity while keeping academic records private and offchain."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="font-heading text-xl">
              Student profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-1 border-b pb-3">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{dashboard.displayName}</span>
            </div>
            <div className="grid gap-1 border-b pb-3">
              <span className="text-muted-foreground">Institution</span>
              <span className="font-medium">{dashboard.institutionName}</span>
            </div>
            <div className="grid gap-1">
              <span className="text-muted-foreground">Program</span>
              <span className="font-medium">{dashboard.programName}</span>
            </div>
          </CardContent>
        </Card>
        <IdentitySetupCard
          credentialType={partnerStatus?.world_credential_type ?? null}
          currentName={partnerStatus?.ens_name ?? null}
          currentStatus={partnerStatus?.ens_status ?? null}
          ensCapability={ensCapability}
          institutionName={dashboard.institutionName}
          parentName={process.env.NEXT_PUBLIC_ENS_PARENT ?? null}
          verifiedAt={partnerStatus?.world_verified_at ?? null}
          walletAddress={verifiedWallet?.address ?? null}
          walletLinkAvailable={isEnsWalletLinkConfigured(process.env)}
          worldCapability={worldCapability}
          worldVerified={worldVerified}
        />
      </div>
    </>
  );
}
