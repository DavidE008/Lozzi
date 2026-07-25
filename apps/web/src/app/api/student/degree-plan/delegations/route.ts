import { randomBytes, randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth";
import { hashDelegationToken } from "@/lib/agentkit/commitments";
import { createDegreePlanDelegation } from "@/lib/agentkit/records";
import { logEvent } from "@/lib/logging";
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
    const dashboard = await getDashboardForUser(user.id);
    if (!dashboard) {
      return NextResponse.json(
        { error: "Student profile required." },
        { status: 403 },
      );
    }
    const idempotencyHeader = request.headers.get("idempotency-key");
    const idempotencyKey = idempotencyHeader
      ? z.uuid().parse(idempotencyHeader)
      : randomUUID();
    const delegationToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1_000).toISOString();
    const delegation = await createDegreePlanDelegation({
      expiresAt,
      idempotencyKey,
      studentId: dashboard.studentId,
      tokenHash: hashDelegationToken(delegationToken),
    });

    return NextResponse.json(
      { ...delegation, delegationToken },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    logEvent("warn", "degree_plan_delegation_failed", {
      category:
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : "invalid-request",
    });
    return NextResponse.json(
      { error: "The degree-plan delegation could not be created." },
      { status: 400 },
    );
  }
}
