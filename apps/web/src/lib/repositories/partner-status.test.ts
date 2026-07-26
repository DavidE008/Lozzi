import { describe, expect, it } from "vitest";

import {
  hasVerifiedWorldAccount,
  type StudentPartnerStatus,
} from "./partner-status";

const status = (
  input: Partial<StudentPartnerStatus>,
): StudentPartnerStatus => ({
  ai_completed_at: null,
  ai_validation_status: null,
  ens_name: null,
  ens_network: null,
  ens_resolved_at: null,
  ens_status: null,
  institution_id: "10000000-0000-4000-8000-000000000001",
  storage_available_at: null,
  storage_status: null,
  student_id: "13000000-0000-4000-8000-000000000101",
  user_id: "00000000-0000-4000-8000-000000000101",
  world_credential_type: null,
  world_status: null,
  world_verified_at: null,
  ...input,
});

describe("World account status", () => {
  it("accepts only a complete account-humanity verification", () => {
    expect(
      hasVerifiedWorldAccount(
        status({
          world_credential_type: "proof_of_human",
          world_status: "verified",
          world_verified_at: "2026-07-25T10:00:00.000Z",
        }),
      ),
    ).toBe(true);
    expect(
      hasVerifiedWorldAccount(
        status({
          world_credential_type: "orb",
          world_status: "verified",
          world_verified_at: "2026-07-25T10:00:00.000Z",
        }),
      ),
    ).toBe(true);
  });

  it("fails closed for missing or purpose-specific World evidence", () => {
    expect(hasVerifiedWorldAccount(null)).toBe(false);
    expect(
      hasVerifiedWorldAccount(
        status({
          world_credential_type: "selfie",
          world_status: "verified",
          world_verified_at: "2026-07-25T10:00:00.000Z",
        }),
      ),
    ).toBe(false);
    expect(
      hasVerifiedWorldAccount(
        status({
          world_credential_type: "proof_of_human",
          world_status: "verified",
        }),
      ),
    ).toBe(false);
  });
});
