"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { logEvent } from "@/lib/logging";
import { getRoleHomeForUser } from "@/lib/repositories/access";
import { assertSameOrigin } from "@/lib/security/origin";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(128),
});

export interface SignInResult {
  readonly error?: string;
}

export const signIn = async (
  input: z.infer<typeof credentialsSchema>,
): Promise<SignInResult> => {
  let destination: string;
  try {
    await assertSameOrigin();
    const credentials = credentialsSchema.parse(input);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword(credentials);

    if (error) {
      logEvent("warn", "sign_in_denied", {
        category: error.code ?? "auth_error",
      });
      return { error: "Those sign-in details were not recognised." };
    }

    logEvent("info", "sign_in_succeeded");
    destination = await getRoleHomeForUser(data.user.id);
  } catch (error) {
    logEvent("warn", "sign_in_rejected", {
      category:
        error instanceof z.ZodError ? "invalid_input" : "request_rejected",
    });
    return { error: "Sign-in could not be completed. Please try again." };
  }

  redirect(destination);
};

export const signOut = async () => {
  await assertSameOrigin();
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth");
};
