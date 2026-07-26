import { publicVerifierRequestSchema } from "@lozzi/domain";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { logEvent } from "@/lib/logging";
import { getVerifierRequestFingerprint } from "@/lib/public-verifier/request-security";
import { verifyPublicShare } from "@/lib/public-verifier/service";

const responseHeaders = {
  "cache-control": "no-store, max-age=0",
  "referrer-policy": "no-referrer",
};

export async function POST(request: Request): Promise<Response> {
  try {
    if (new URL(request.url).searchParams.has("token")) {
      return NextResponse.json(
        { error: "Query-string tokens are not accepted." },
        { headers: responseHeaders, status: 400 },
      );
    }
    if (
      request.headers.get("content-type")?.split(";")[0] !== "application/json"
    ) {
      return NextResponse.json(
        { error: "A JSON request body is required." },
        { headers: responseHeaders, status: 415 },
      );
    }
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 1_024) {
      return NextResponse.json(
        { error: "The verifier request is too large." },
        { headers: responseHeaders, status: 413 },
      );
    }

    const input = publicVerifierRequestSchema.parse(await request.json());
    const result = await verifyPublicShare({
      requestFingerprint: getVerifierRequestFingerprint(request),
      token: input.token,
    });
    return NextResponse.json(result, { headers: responseHeaders });
  } catch (error) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "";
    const rateLimited = message === "Public verifier rate limit exceeded";
    const configurationUnavailable =
      message === "Public verifier request fingerprinting is not configured.";
    const errorCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code.slice(0, 32)
        : null;
    logEvent("warn", "public_verifier_failed", {
      category: rateLimited
        ? "rate-limited"
        : configurationUnavailable
          ? "configuration"
          : "invalid-request",
      code: errorCode,
      source:
        error instanceof ZodError
          ? "validation"
          : errorCode
            ? "database"
            : "runtime",
    });
    return NextResponse.json(
      {
        error: rateLimited
          ? "Too many verification attempts. Try again later."
          : configurationUnavailable
            ? "Public verification is temporarily unavailable."
            : "The share token could not be verified.",
      },
      {
        headers: responseHeaders,
        status: rateLimited ? 429 : configurationUnavailable ? 503 : 400,
      },
    );
  }
}
