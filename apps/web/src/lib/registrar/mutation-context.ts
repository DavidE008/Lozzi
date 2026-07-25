import { hasRegistrarAccess } from "@lozzi/domain";

import { getAuthenticatedUser } from "@/lib/auth";
import { logEvent } from "@/lib/logging";
import { getInstitutionAccessForUser } from "@/lib/repositories/access";
import { assertSameOrigin } from "@/lib/security/origin";
import { createClient } from "@/lib/supabase/server";

export interface RegistrarActionResult {
  readonly error?: string;
  readonly success?: string;
}

export const getRegistrarMutationContext = async (institutionId: string) => {
  await assertSameOrigin();
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Authentication required.");

  const access = await getInstitutionAccessForUser(user.id);
  if (
    !access ||
    access.institutionId !== institutionId ||
    !hasRegistrarAccess(access.roles)
  ) {
    throw new Error("Registrar access required.");
  }

  return {
    access,
    supabase: await createClient(),
    user,
  };
};

export const mutationError = (
  event: string,
  error: { readonly code?: string } | unknown,
): RegistrarActionResult => {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "request_rejected";

  logEvent("warn", event, { category: code });

  if (code === "23505") {
    return { error: "That code or assignment already exists." };
  }
  if (code === "23503") {
    return { error: "A selected academic resource is no longer available." };
  }
  if (code === "42501") {
    return { error: "Your current institution role cannot make this change." };
  }
  return { error: "The change could not be saved. Please try again." };
};
