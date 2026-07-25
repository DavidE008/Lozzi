import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth";
import { createWorldVerificationProvider } from "@/lib/integrations/world";
import { logEvent } from "@/lib/logging";
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
    const request = await createWorldVerificationProvider().createRequest(
      user.id,
    );
    return NextResponse.json(request, {
      headers: { "cache-control": "no-store" },
    });
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
      { error: "World verification is not configured." },
      { status: 503 },
    );
  }
}
