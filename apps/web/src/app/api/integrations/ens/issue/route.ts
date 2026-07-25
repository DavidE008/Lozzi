import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth";
import { getEnsConfig } from "@/lib/integrations/config";
import { createEnsNameProvider } from "@/lib/integrations/ens";
import { classifyPartnerError } from "@/lib/integrations/errors";
import {
  recordCapabilityState,
  recordEnsIdentity,
} from "@/lib/integrations/partner-records";
import { logEvent } from "@/lib/logging";
import { getInstitutionAccessForUser } from "@/lib/repositories/access";
import { getVerifiedStudentWallet } from "@/lib/repositories/partner-status";
import { getDashboardForUser } from "@/lib/repositories/student";
import { assertSameOrigin } from "@/lib/security/origin";

const requestSchema = z.object({
  label: z.string().trim().min(1).max(63),
});

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

    const { label } = requestSchema.parse(await request.json());
    const config = getEnsConfig();
    const idempotencyKey = randomUUID();
    const result = await createEnsNameProvider().issueSubname({
      idempotencyKey,
      label,
      walletAddress: wallet.address,
    });
    await recordEnsIdentity({
      idempotencyKey,
      name: result.name,
      parentName: config.parentName,
      studentId: dashboard.studentId,
      studentWalletId: wallet.id,
      transactionHash: result.transactionHash,
      walletAddress: wallet.address,
    });
    await recordCapabilityState({
      detail: "A Sepolia ENS subname was issued and resolved successfully.",
      errorCategory: null,
      evidenceReference: result.transactionHash ?? null,
      institutionId: access.institutionId,
      provider: "ens",
      state: "available",
    });

    return NextResponse.json({
      name: result.name,
      status: "active",
      transactionHash: result.transactionHash,
    });
  } catch (error) {
    const classified = classifyPartnerError(error);
    logEvent("warn", "ens_subname_issue_failed", {
      category: classified.category,
    });
    return NextResponse.json(
      { error: classified.publicMessage },
      { status: classified.category === "configuration" ? 503 : 400 },
    );
  }
}
