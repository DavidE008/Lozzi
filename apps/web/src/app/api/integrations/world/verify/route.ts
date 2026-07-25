import { z } from "zod";
import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth";
import {
  consumeWorldProofChallenge,
  getWorldProofChallenge,
  recordCapabilityState,
} from "@/lib/integrations/partner-records";
import {
  classifyPartnerError,
  PartnerIntegrationError,
} from "@/lib/integrations/errors";
import { createWorldVerificationProvider } from "@/lib/integrations/world";
import { logEvent } from "@/lib/logging";
import { getInstitutionAccessForUser } from "@/lib/repositories/access";
import { getDashboardForUser } from "@/lib/repositories/student";
import { assertSameOrigin } from "@/lib/security/origin";

const challengeIdSchema = z.uuid();

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

    const challengeId = challengeIdSchema.parse(
      new URL(request.url).searchParams.get("challengeId"),
    );
    const challenge = await getWorldProofChallenge(
      challengeId,
      dashboard.studentId,
    );
    if (!challenge) {
      throw new PartnerIntegrationError(
        "replay",
        "The World challenge was expired, consumed, or did not belong to this student.",
      );
    }

    const rawBody = await request.text();
    const verified = await createWorldVerificationProvider().verify({
      authenticatedUserId: user.id,
      challengeId: challenge.challengeId,
      expectedEnvironment: challenge.environment,
      expectedNonce: challenge.nonce,
      purpose: challenge.purpose,
      rawBody,
      subjectId: challenge.subjectId ?? undefined,
    });
    await consumeWorldProofChallenge({
      ...verified,
      studentId: dashboard.studentId,
    });
    await recordCapabilityState({
      detail: "A purpose-bound World proof was verified successfully.",
      errorCategory: null,
      evidenceReference: verified.providerResponseId ?? null,
      institutionId: access.institutionId,
      provider: "world",
      state: "available",
    });

    return NextResponse.json(
      {
        credentialType: verified.credentialType,
        identityAttested: verified.identityAttested,
        purpose: verified.purpose,
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
      {
        status:
          classified.category === "configuration"
            ? 503
            : classified.category === "replay"
              ? 409
              : 400,
      },
    );
  }
}
