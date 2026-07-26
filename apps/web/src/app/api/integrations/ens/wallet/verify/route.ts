import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth";
import { verifyWalletLinkChallenge } from "@/lib/integrations/ens-wallet";
import { classifyPartnerError } from "@/lib/integrations/errors";
import { logEvent } from "@/lib/logging";
import {
  getStudentPartnerStatus,
  hasVerifiedWorldAccount,
} from "@/lib/repositories/partner-status";
import { getDashboardForUser } from "@/lib/repositories/student";
import { assertSameOrigin } from "@/lib/security/origin";

const requestSchema = z
  .object({
    challengeId: z.uuid(),
    message: z.string().min(1).max(4096),
    signature: z
      .string()
      .regex(/^0x[0-9a-fA-F]+$/u)
      .max(16_384),
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
    const identityStatus = await getStudentPartnerStatus(dashboard.studentId);
    if (!hasVerifiedWorldAccount(identityStatus)) {
      return NextResponse.json(
        { error: "Verify your personhood before linking a wallet." },
        { status: 409 },
      );
    }

    const input = requestSchema.parse(await request.json());
    const wallet = await verifyWalletLinkChallenge({
      challengeId: input.challengeId,
      message: input.message,
      signature: input.signature as `0x${string}`,
      studentId: dashboard.studentId,
    });
    return NextResponse.json(
      {
        address: wallet.address,
        status: "verified",
        verifiedAt: wallet.verifiedAt,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const classified = classifyPartnerError(error);
    logEvent("warn", "ens_wallet_verification_failed", {
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
              : classified.category === "authentication"
                ? 401
                : 400,
      },
    );
  }
}
