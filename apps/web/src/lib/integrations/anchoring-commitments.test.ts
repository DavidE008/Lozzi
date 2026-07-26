import { describe, expect, it } from "vitest";

import { createAnchoringCommitmentIdentity } from "./anchoring-commitments";

const source = {
  ANCHORING_COMMITMENT_ENVIRONMENT: "test",
  ANCHORING_COMMITMENT_KEY_VERSION: "1",
  ANCHORING_INSTITUTION_ROOT_SECRET: `0x${"11".repeat(32)}`,
  ANCHORING_STUDENT_ROOT_SECRET: `0x${"22".repeat(32)}`,
};

describe("server-only anchoring commitment identity", () => {
  it("derives stable institution-scoped commitments without returning secrets", () => {
    const identity = createAnchoringCommitmentIdentity(
      {
        institutionId: "10000000-0000-4000-8000-000000000001",
        studentOpaqueId: "13000000-0000-4000-8000-000000000101",
      },
      source,
    );

    expect(identity).toEqual({
      commitmentEnvironment: "test",
      institutionCommitment:
        "0xea4d07cfd9beead9fca1473e94a460124d6ab3467284d307af7d6b864785f461",
      institutionCommitmentAlgorithm: "lozzi-institution-v1",
      institutionCommitmentKeyVersion: 1,
      studentCommitment:
        "0x72bc6452fc51c07365d8b9f53afa4ec88fdbe0af8eaf7f9b548ac10855de5c7c",
      studentCommitmentAlgorithm: "lozzi-student-v1",
      studentCommitmentKeyVersion: 1,
    });
    expect(JSON.stringify(identity)).not.toContain(
      source.ANCHORING_INSTITUTION_ROOT_SECRET,
    );
    expect(JSON.stringify(identity)).not.toContain(
      source.ANCHORING_STUDENT_ROOT_SECRET,
    );
  });

  it("separates institutions and environments", () => {
    const baseline = createAnchoringCommitmentIdentity(
      {
        institutionId: "10000000-0000-4000-8000-000000000001",
        studentOpaqueId: "13000000-0000-4000-8000-000000000101",
      },
      source,
    );
    const otherInstitution = createAnchoringCommitmentIdentity(
      {
        institutionId: "10000000-0000-4000-8000-000000000002",
        studentOpaqueId: "13000000-0000-4000-8000-000000000101",
      },
      source,
    );
    const production = createAnchoringCommitmentIdentity(
      {
        institutionId: "10000000-0000-4000-8000-000000000001",
        studentOpaqueId: "13000000-0000-4000-8000-000000000101",
      },
      { ...source, ANCHORING_COMMITMENT_ENVIRONMENT: "production" },
    );

    expect(
      new Set([
        baseline.studentCommitment,
        otherInstitution.studentCommitment,
        production.studentCommitment,
      ]),
    ).toHaveLength(3);
  });

  it("fails closed when commitment configuration is absent or malformed", () => {
    expect(() =>
      createAnchoringCommitmentIdentity(
        {
          institutionId: "10000000-0000-4000-8000-000000000001",
          studentOpaqueId: "13000000-0000-4000-8000-000000000101",
        },
        {},
      ),
    ).toThrow();
    expect(() =>
      createAnchoringCommitmentIdentity(
        {
          institutionId: "10000000-0000-4000-8000-000000000001",
          studentOpaqueId: "13000000-0000-4000-8000-000000000101",
        },
        { ...source, ANCHORING_STUDENT_ROOT_SECRET: "not-a-secret" },
      ),
    ).toThrow();
  });
});
