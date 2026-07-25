import { headers } from "next/headers";

export const isSameOrigin = (origin: string | null, host: string | null): boolean => {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

export const assertSameOrigin = async (): Promise<void> => {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (!isSameOrigin(origin, host)) {
    throw new Error("Cross-origin mutation rejected.");
  }
};
