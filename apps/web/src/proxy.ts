import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import {
  buildContentSecurityPolicy,
  hasConfiguredWorldBrowserFlow,
} from "@/lib/security/content-security-policy";
import type { Database } from "@/lib/supabase/database.types";

const securityHeaders = (response: NextResponse, nonce: string) => {
  response.headers.set(
    "Content-Security-Policy",
    buildContentSecurityPolicy({
      isDevelopment: process.env.NODE_ENV === "development",
      nonce,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      worldFlowConfigured: hasConfiguredWorldBrowserFlow(process.env),
    }),
  );
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
};

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (url && key) {
    const supabase = createServerClient<Database>(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headersToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headersToSet).forEach(([name, value]) =>
            response.headers.set(name, value),
          );
        },
      },
    });

    const { data } = await supabase.auth.getClaims();
    const authenticated = Boolean(data?.claims?.sub);
    const protectedRoute =
      request.nextUrl.pathname.startsWith("/student") ||
      request.nextUrl.pathname.startsWith("/registrar") ||
      request.nextUrl.pathname.startsWith("/instructor");

    if (protectedRoute && !authenticated) {
      const signInUrl = request.nextUrl.clone();
      signInUrl.pathname = "/auth";
      signInUrl.searchParams.set("next", request.nextUrl.pathname);
      response = NextResponse.redirect(signInUrl);
    } else if (request.nextUrl.pathname === "/auth" && authenticated) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      homeUrl.search = "";
      response = NextResponse.redirect(homeUrl);
    }
  }

  securityHeaders(response, nonce);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
