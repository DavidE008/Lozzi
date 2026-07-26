import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth";
import { revokeStudentWalletRecord } from "@/lib/integrations/ens-records";
import { classifyPartnerError } from "@/lib/integrations/errors";
import { logEvent } from "@/lib/logging";
import { getVerifiedStudentWallet } from "@/lib/repositories/partner-status";
import { getDashboardForUser } from "@/lib/repositories/student";
import { assertSameOrigin } from "@/lib/security/origin";

export async function POST(): Promise<Response> {
  try {
    await assertSameOrigin();
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }
    const dashboard = await getDashboardForUser(user.id);
    if (!dashboard) {
      return NextResponse.json(
        { error: "Student profile required." },
        { status: 403 },
      );
    }
    const wallet = await getVerifiedStudentWallet(dashboard.studentId);
    if (!wallet) {
      return NextResponse.json(
        { error: "No verified Sepolia wallet is linked." },
        { status: 409 },
      );
    }

    const revoked = await revokeStudentWalletRecord(
      dashboard.studentId,
      wallet.id,
    );
    return NextResponse.json(revoked, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const classified = classifyPartnerError(error);
    logEvent("warn", "ens_wallet_revocation_failed", {
      category: classified.category,
    });
    return NextResponse.json(
      { error: classified.publicMessage },
      { status: classified.category === "configuration" ? 503 : 400 },
    );
  }
}
