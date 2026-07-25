"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";
import { getSupabaseConfig } from "./config";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export const createClient = () => {
  const { url, publishableKey } = getSupabaseConfig();
  browserClient ??= createBrowserClient<Database>(url, publishableKey);
  return browserClient;
};
