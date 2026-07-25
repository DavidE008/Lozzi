import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth";
import { createSensitiveShareDraft } from "@/lib/integrations/sensitive-shares";
import { logEvent } from "@/lib/logging";
import {
  getCurrentAcademicRecordVersionId,
  getDashboardForUser,
} from "@/lib/repositories/student";
import { assertSameOrigin } from "@/lib/security/origin";

const createDraftSchema = z
  .object({
    recipientLabel: z.string().trim().min(1).max(120),
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
    const dashboard = await getDashboardForUser(user.id);
    if (!dashboard) {
      return NextResponse.json(
        { error: "Student profile required." },
        { status: 403 },
      );
    }
    const input = createDraftSchema.parse(await request.json());
    const idempotencyHeader = request.headers.get("idempotency-key");
    const idempotencyKey = idempotencyHeader
      ? z.uuid().parse(idempotencyHeader)
      : randomUUID();
    const recordVersionId = await getCurrentAcademicRecordVersionId(
      dashboard.studentId,
    );
    if (!recordVersionId) {
      return NextResponse.json(
        { error: "A published academic record is required." },
        { status: 409 },
      );
    }

    const result = await createSensitiveShareDraft({
      academicRecordVersionId: recordVersionId,
      grantExpiresAt: new Date(Date.now() + 30 * 60 * 1_000).toISOString(),
      idempotencyKey,
      recipientLabel: input.recipientLabel,
      scopes: ["program", "degree-progress", "record-summary", "full-record"],
      studentId: dashboard.studentId,
    });

    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    logEvent("warn", "sensitive_share_draft_failed", {
      category:
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : "invalid-request",
    });
    return NextResponse.json(
      { error: "The sensitive share draft could not be created." },
      { status: 400 },
    );
  }
}
