import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth";
import { issueEnsAlias } from "@/lib/integrations/ens-issuance";
import { classifyPartnerError } from "@/lib/integrations/errors";
import { recordCapabilityState } from "@/lib/integrations/partner-records";
import { logEvent } from "@/lib/logging";
import { getInstitutionAccessForUser } from "@/lib/repositories/access";
import { getVerifiedStudentWallet } from "@/lib/repositories/partner-status";
import { getDashboardForUser } from "@/lib/repositories/student";
import { assertSameOrigin } from "@/lib/security/origin";

const requestSchema = z
  .object({
    consent: z.literal(true),
    label: z.string().trim().min(1).max(32),
    requestId: z.uuid(),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  try {
    await assertSameOrigin();
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }
    const [dashboard, access] = await Promise.all([
      getDashboardForUser(user.id),
      getInstitutionAccessForUser(user.id),
    ]);
    if (!dashboard || !access) {
      return NextResponse.json(
        { error: "Student profile required." },
        { status: 403 },
      );
    }
    const wallet = await getVerifiedStudentWallet(dashboard.studentId);
    if (!wallet) {
      return NextResponse.json(
        { error: "A verified Ethereum Sepolia wallet is required." },
        { status: 409 },
      );
    }

    const input = requestSchema.parse(await request.json());
    const result = await issueEnsAlias({
      consentedAt: new Date().toISOString(),
      label: input.label,
      requestId: input.requestId,
      studentId: dashboard.studentId,
      studentWalletId: wallet.id,
      walletAddress: wallet.address,
    });

    if (result.status === "active") {
      await recordCapabilityState({
        detail: "A Sepolia ENS subname was issued and resolved successfully.",
        errorCategory: null,
        evidenceReference: result.transactionHash,
        institutionId: access.institutionId,
        provider: "ens",
        state: "available",
      });
    }

    return NextResponse.json(
      {
        name: result.name,
        operationId: result.operationId,
        status: result.status,
        transactionHash: result.transactionHash,
      },
      {
        status:
          result.status === "submitting" || result.status === "submitted"
            ? 202
            : 200,
      },
    );
  } catch (error) {
    const classified = classifyPartnerError(error);
    logEvent("warn", "ens_subname_issue_failed", {
      category: classified.category,
    });
    return NextResponse.json(
      { error: classified.publicMessage },
      {
        status:
          classified.category === "configuration"
            ? 503
            : classified.category === "replay"
              ? 409
              : classified.category === "rate-limited"
                ? 429
                : 400,
      },
    );
  }
}
