import { cache } from "react";
import { z } from "zod";

import { logEvent } from "@/lib/logging";
import { createClient } from "@/lib/supabase/server";

const partnerStatusSchema = z
  .object({
    ai_completed_at: z.string().nullable(),
    ai_validation_status: z.string().nullable(),
    ens_name: z.string().nullable(),
    ens_network: z.string().nullable(),
    ens_resolved_at: z.string().nullable(),
    ens_status: z.string().nullable(),
    institution_id: z.string().uuid(),
    storage_available_at: z.string().nullable(),
    storage_status: z.string().nullable(),
    student_id: z.string().uuid(),
    user_id: z.string().uuid(),
    world_credential_type: z.string().nullable(),
    world_status: z.string().nullable(),
    world_verified_at: z.string().nullable(),
  })
  .strict();

export type StudentPartnerStatus = z.infer<typeof partnerStatusSchema>;

interface PartnerSummaryClient {
  from(table: "student_partner_summary"): {
    select(columns: "*"): {
      eq(
        column: "student_id",
        value: string,
      ): {
        maybeSingle(): Promise<{
          readonly data: unknown;
          readonly error: { readonly code?: string } | null;
        }>;
      };
    };
  };
}

interface StudentWalletClient {
  from(table: "student_wallets"): {
    select(columns: "id, address, chain_id, status"): {
      eq(
        column: "student_id",
        value: string,
      ): {
        eq(
          column: "chain_id",
          value: number,
        ): {
          eq(
            column: "status",
            value: "verified",
          ): {
            maybeSingle(): Promise<{
              readonly data: unknown;
              readonly error: { readonly code?: string } | null;
            }>;
          };
        };
      };
    };
  };
}

const studentWalletSchema = z.object({
  address: z.string().regex(/^\\x[0-9a-fA-F]{40}$/u),
  chain_id: z.literal(11155111),
  id: z.string().uuid(),
  status: z.literal("verified"),
});

export interface VerifiedStudentWallet {
  readonly address: `0x${string}`;
  readonly id: string;
}

export const getStudentPartnerStatus = cache(
  async (studentId: string): Promise<StudentPartnerStatus | null> => {
    const client = (await createClient()) as unknown as PartnerSummaryClient;
    const { data, error } = await client
      .from("student_partner_summary")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle();

    if (error) {
      logEvent("warn", "student_partner_summary_failed", {
        category: error.code ?? "unknown",
      });
      return null;
    }
    return data ? partnerStatusSchema.parse(data) : null;
  },
);

export const getVerifiedStudentWallet = cache(
  async (studentId: string): Promise<VerifiedStudentWallet | null> => {
    const client = (await createClient()) as unknown as StudentWalletClient;
    const { data, error } = await client
      .from("student_wallets")
      .select("id, address, chain_id, status")
      .eq("student_id", studentId)
      .eq("chain_id", 11155111)
      .eq("status", "verified")
      .maybeSingle();

    if (error) {
      logEvent("warn", "student_verified_wallet_failed", {
        category: error.code ?? "unknown",
      });
      return null;
    }
    if (!data) return null;
    const wallet = studentWalletSchema.parse(data);
    return { address: `0x${wallet.address.slice(2)}`, id: wallet.id };
  },
);
