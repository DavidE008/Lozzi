import { z } from "zod";

import { logEvent } from "@/lib/logging";
import { createClient } from "@/lib/supabase/server";

const oversightRowSchema = z.object({
  request_id: z.string(),
  institution_id: z.string(),
  student_id: z.string(),
  student_display_name: z.string(),
  term_name: z.string(),
  status: z.enum(["accepted", "rejected"]),
  section_count: z.number().int(),
  created_at: z.string(),
});

interface RegistrationOversightClient {
  from(table: "registrar_registration_activity"): {
    select(columns: "*"): {
      eq(column: "institution_id", value: string): {
        order(
          column: "created_at",
          options: { readonly ascending: false },
        ): Promise<{
          readonly data: unknown;
          readonly error: { readonly code?: string } | null;
        }>;
      };
    };
  };
}

export interface RegistrationOversightItem {
  readonly id: string;
  readonly studentId: string;
  readonly studentDisplayName: string;
  readonly termName: string;
  readonly status: "accepted" | "rejected";
  readonly sectionCount: number;
  readonly createdAt: string;
}

export const getRegistrationOversight = async (
  institutionId: string,
): Promise<readonly RegistrationOversightItem[]> => {
  const supabase = (await createClient()) as unknown as RegistrationOversightClient;
  const { data, error } = await supabase
    .from("registrar_registration_activity")
    .select("*")
    .eq("institution_id", institutionId)
    .order("created_at", { ascending: false });

  if (error) {
    logEvent("error", "registration_oversight_failed", {
      category: error.code ?? "unknown",
    });
    throw new Error("Registration activity could not be loaded.");
  }

  return z.array(oversightRowSchema).parse(data).map((row) => ({
    id: row.request_id,
    studentId: row.student_id,
    studentDisplayName: row.student_display_name,
    termName: row.term_name,
    status: row.status,
    sectionCount: row.section_count,
    createdAt: row.created_at,
  }));
};

