import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth";
import { createWalletLinkChallenge } from "@/lib/integrations/ens-wallet";
import { classifyPartnerError } from "@/lib/integrations/errors";
import { logEvent } from "@/lib/logging";
import { getDashboardForUser } from "@/lib/repositories/student";
import { assertSameOrigin } from "@/lib/security/origin";

const requestSchema = z
  .object({
    address: z.string().regex(/^0x[0-9a-fA-F]{40}$/u),
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

    const input = requestSchema.parse(await request.json());
    const challenge = await createWalletLinkChallenge({
      address: input.address as `0x${string}`,
      studentId: dashboard.studentId,
    });
    return NextResponse.json(challenge, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const classified = classifyPartnerError(error);
    logEvent("warn", "ens_wallet_challenge_failed", {
      category: classified.category,
    });
    return NextResponse.json(
      { error: classified.publicMessage },
      {
        status:
          classified.category === "configuration"
            ? 503
            : classified.category === "rate-limited"
              ? 429
              : 400,
      },
    );
  }
}
