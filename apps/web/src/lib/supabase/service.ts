import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getServiceDatabaseConfig } from "@/lib/integrations/config";

import type { Database } from "./database.types";

export const createServiceClient = () => {
  const { secretKey, url } = getServiceDatabaseConfig();
  return createClient<Database>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
};
