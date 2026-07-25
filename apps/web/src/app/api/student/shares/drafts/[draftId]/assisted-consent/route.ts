import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth";
import { requestRegistrarAssistedConsent } from "@/lib/integrations/sensitive-shares";
import { logEvent } from "@/lib/logging";
import { getDashboardForUser } from "@/lib/repositories/student";
import { assertSameOrigin } from "@/lib/security/origin";

export async function POST(
  _request: Request,
  context: { params: Promise<{ draftId: string }> },
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
    const dashboard = await getDashboardForUser(user.id);
    if (!dashboard) {
      return NextResponse.json(
        { error: "Student profile required." },
        { status: 403 },
      );
    }
    const draftId = z.uuid().parse((await context.params).draftId);
    const result = await requestRegistrarAssistedConsent({
      draftId,
      studentId: dashboard.studentId,
    });
    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    logEvent("warn", "sensitive_share_assistance_failed", {
      category:
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : "invalid-request",
    });
    return NextResponse.json(
      { error: "Registrar-assisted consent could not be requested." },
      { status: 400 },
    );
  }
}
