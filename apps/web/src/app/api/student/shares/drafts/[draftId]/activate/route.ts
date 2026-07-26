import { createHash, randomBytes, randomUUID } from "node:crypto";

import { createCommitment } from "@lozzi/domain";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth";
import { createAnchoringCommitmentIdentity } from "@/lib/integrations/anchoring-commitments";
import { activateSensitiveShare } from "@/lib/integrations/sensitive-shares";
import { logEvent } from "@/lib/logging";
import { getInstitutionAccessForUser } from "@/lib/repositories/access";
import { getDashboardForUser } from "@/lib/repositories/student";
import { assertSameOrigin } from "@/lib/security/origin";

const sha256Hex = (value: Uint8Array): `0x${string}` =>
  `0x${createHash("sha256").update(value).digest("hex")}`;

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
    const draftId = z.uuid().parse((await context.params).draftId);
    const tokenBytes = randomBytes(32);
    const tokenSalt = `0x${tokenBytes.toString("hex")}` as const;
    const shareToken = tokenBytes.toString("base64url");
    const identity = createAnchoringCommitmentIdentity({
      institutionId: access.institutionId,
      studentOpaqueId: dashboard.studentId,
    });
    const activation = await activateSensitiveShare({
      commitmentEnvironment: identity.commitmentEnvironment,
      correlationId: randomUUID(),
      draftId,
      grantCommitment: createCommitment({
        domain: "share-grant",
        institutionId: access.institutionId,
        payload: {
          draftId,
          studentId: dashboard.studentId,
        },
        salt: tokenSalt,
      }),
      institutionCommitment: identity.institutionCommitment,
      institutionCommitmentKeyVersion: identity.institutionCommitmentKeyVersion,
      studentCommitment: identity.studentCommitment,
      studentCommitmentKeyVersion: identity.studentCommitmentKeyVersion,
      tokenHash: sha256Hex(tokenBytes),
      traceId: randomUUID(),
    });

    return NextResponse.json(
      { ...activation, shareToken },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    logEvent("warn", "sensitive_share_activation_failed", {
      category:
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : "invalid-request",
    });
    return NextResponse.json(
      { error: "The sensitive share could not be activated." },
      { status: 400 },
    );
  }
}
