import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth";
import { revokeSensitiveShare } from "@/lib/integrations/sensitive-shares";
import { logEvent } from "@/lib/logging";
import { assertSameOrigin } from "@/lib/security/origin";

export async function POST(
  request: Request,
  context: { params: Promise<{ shareGrantId: string }> },
): Promise<Response> {
  try {
    await assertSameOrigin();
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const shareGrantId = z.uuid().parse((await context.params).shareGrantId);
    const idempotencyHeader = request.headers.get("idempotency-key");
    const result = await revokeSensitiveShare({
      correlationId: randomUUID(),
      idempotencyKey: idempotencyHeader
        ? z.uuid().parse(idempotencyHeader)
        : randomUUID(),
      shareGrantId,
      traceId: randomUUID(),
    });

    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    logEvent("warn", "sensitive_share_revocation_failed", {
      category:
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code.slice(0, 32)
          : "invalid-request",
    });
    return NextResponse.json(
      { error: "The share could not be revoked." },
      { status: 400 },
    );
  }
}
