import {
  type InstitutionAccess,
  type InstitutionRole,
  roleHomePath,
} from "@lozzi/domain";
import { cache } from "react";

import { logEvent } from "@/lib/logging";
import { createClient } from "@/lib/supabase/server";

const institutionRoles = new Set<InstitutionRole>([
  "student",
  "registrar",
  "instructor",
  "advisor",
  "institution_admin",
]);

interface MembershipRow {
  readonly institution_id: string;
  readonly role: string;
  readonly institutions: {
    readonly name: string;
  } | null;
}

export const mapInstitutionAccess = (
  rows: readonly MembershipRow[],
): InstitutionAccess | null => {
  const first = rows[0];
  if (!first?.institutions) return null;

  const roles = rows
    .filter(
      (row) =>
        row.institution_id === first.institution_id &&
        institutionRoles.has(row.role as InstitutionRole),
    )
    .map((row) => row.role as InstitutionRole);

  if (!roles.length) return null;

  return {
    institutionId: first.institution_id,
    institutionName: first.institutions.name,
    roles,
  };
};

export const getInstitutionAccessForUser = cache(
  async (userId: string): Promise<InstitutionAccess | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("institution_memberships")
      .select("institution_id, role, institutions!inner(name)")
      .eq("user_id", userId)
      .eq("status", "active")
      .is("deactivated_at", null)
      .order("role");

    if (error) {
      logEvent("error", "institution_access_failed", {
        category: error.code,
      });
      throw new Error("Institution access could not be loaded.");
    }

    return mapInstitutionAccess(data);
  },
);

export const getRoleHomeForUser = async (userId: string) => {
  const access = await getInstitutionAccessForUser(userId);
  return roleHomePath(access?.roles ?? []);
};

export const getProfileForUser = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, initials")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    logEvent("error", "profile_access_failed", { category: error.code });
    throw new Error("The staff profile could not be loaded.");
  }

  return data
    ? { displayName: data.display_name, initials: data.initials }
    : null;
});
