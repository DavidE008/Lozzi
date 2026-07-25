import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { worldPurposeRequestSchema } from "@lozzi/domain";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth";
import { createWorldProofChallenge } from "@/lib/integrations/partner-records";
import { createWorldVerificationProvider } from "@/lib/integrations/world";
import { logEvent } from "@/lib/logging";
import { getDashboardForUser } from "@/lib/repositories/student";
import { assertSameOrigin } from "@/lib/security/origin";

const MAX_REQUEST_BYTES = 2_048;
const hexadecimal32Schema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/u)
  .transform((value) => value as `0x${string}`);

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
    const dashboard = await getDashboardForUser(user.id);
    if (!dashboard) {
      return NextResponse.json(
        { error: "Student profile required." },
        { status: 403 },
      );
    }

    const rawBody = await request.text();
    if (
      rawBody.length === 0 ||
      new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES
    ) {
      return NextResponse.json(
        { error: "A bounded World purpose is required." },
        { status: 400 },
      );
    }
    const input = worldPurposeRequestSchema.parse(
      JSON.parse(rawBody) as unknown,
    );
    const worldRequest = await createWorldVerificationProvider().createRequest({
      authenticatedUserId: user.id,
      purpose: input.purpose,
      subjectId: input.subjectId,
    });
    const challenge = await createWorldProofChallenge({
      action: worldRequest.action,
      environment: worldRequest.environment,
      expectedSignalHash: worldRequest.signal
        ? hexadecimal32Schema.parse(hashSignal(worldRequest.signal))
        : null,
      expiresAt: new Date(
        worldRequest.rpContext.expires_at * 1_000,
      ).toISOString(),
      nonce: hexadecimal32Schema.parse(worldRequest.rpContext.nonce),
      purpose: worldRequest.purpose,
      studentId: dashboard.studentId,
      subjectId: worldRequest.subjectId,
    });

    return NextResponse.json(
      {
        ...worldRequest,
        challengeId: challenge.challengeId,
        challengeExpiresAt: challenge.expiresAt,
      },
      {
        headers: { "cache-control": "no-store" },
      },
    );
  } catch (error) {
    logEvent("warn", "world_request_failed", {
      category:
        typeof error === "object" &&
        error !== null &&
        "category" in error &&
        typeof error.category === "string"
          ? error.category
          : "configuration",
    });
    return NextResponse.json(
      { error: "World verification is not configured for this purpose." },
      { status: 503 },
    );
  }
}
