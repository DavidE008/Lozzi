import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth";
import {
  recordCapabilityState,
  recordWorldVerification,
} from "@/lib/integrations/partner-records";
import { classifyPartnerError } from "@/lib/integrations/errors";
import { createWorldVerificationProvider } from "@/lib/integrations/world";
import { logEvent } from "@/lib/logging";
import { getInstitutionAccessForUser } from "@/lib/repositories/access";
import { getDashboardForUser } from "@/lib/repositories/student";
import { assertSameOrigin } from "@/lib/security/origin";

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

    const idkitResult = (await request.json()) as unknown;
    const verified = await createWorldVerificationProvider().verify({
      authenticatedUserId: user.id,
      idkitResult,
    });
    await recordWorldVerification({
      ...verified,
      idempotencyKey: randomUUID(),
      studentId: dashboard.studentId,
    });
    await recordCapabilityState({
      detail: "A live World ID proof was verified successfully.",
      errorCategory: null,
      evidenceReference: verified.providerResponseId ?? null,
      institutionId: access.institutionId,
      provider: "world",
      state: "available",
    });

    return NextResponse.json(
      {
        credentialType: verified.credentialType,
        status: "verified",
        verifiedAt: verified.verifiedAt,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const classified = classifyPartnerError(error);
    logEvent("warn", "world_verification_failed", {
      category: classified.category,
    });
    return NextResponse.json(
      { error: classified.publicMessage },
      { status: classified.category === "configuration" ? 503 : 400 },
    );
  }
}
