import "server-only";

import { createHmac } from "node:crypto";

const productionSecret = (environment: NodeJS.ProcessEnv): string => {
  const configured = environment.LOZZI_VERIFIER_FINGERPRINT_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (environment.NODE_ENV !== "production") {
    return "lozzi-local-verifier-fingerprint-only-v1";
  }
  throw new Error("Public verifier request fingerprinting is not configured.");
};

const requestAddress = (request: Request): string => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
};

export const getVerifierRequestFingerprint = (
  request: Request,
  environment: NodeJS.ProcessEnv = process.env,
): `0x${string}` => {
  const source = `${requestAddress(request)}\n${
    request.headers.get("user-agent")?.slice(0, 256) ?? "unknown"
  }`;
  return `0x${createHmac("sha256", productionSecret(environment))
    .update(source)
    .digest("hex")}`;
};
