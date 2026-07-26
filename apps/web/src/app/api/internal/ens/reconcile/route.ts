import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { getEnsReconciliationConfig } from "@/lib/integrations/config";
import { reconcileEnsOperations } from "@/lib/integrations/ens-issuance";
import { classifyPartnerError } from "@/lib/integrations/errors";
import { logEvent } from "@/lib/logging";

const authorized = (request: Request, expectedSecret: string): boolean => {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  const received = Buffer.from(authorization.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(expectedSecret, "utf8");
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
};

export async function POST(request: Request): Promise<Response> {
  try {
    const config = getEnsReconciliationConfig();
    if (!authorized(request, config.secret)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const results = await reconcileEnsOperations();
    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (error) {
    const classified = classifyPartnerError(error);
    logEvent("error", "ens_reconciliation_failed", {
      category: classified.category,
    });
    return NextResponse.json(
      { error: classified.publicMessage },
      { status: classified.category === "configuration" ? 503 : 500 },
    );
  }
}
