import { describe, expect, it } from "vitest";

import {
  canonicalizeJson,
  commitmentPreimage,
  createCommitment,
  createInstitutionCommitment,
  createStudentCommitment,
} from "./commitments";

const fixture = {
  domain: "academic-record" as const,
  institutionId: "10000000-0000-4000-8000-000000000001",
  salt: `0x${"11".repeat(32)}` as const,
  payload: {
    credits: 3,
    course: "CS 1301",
    grade: "A",
    student: "urn:lozzi:student:synthetic-aisha",
  },
};

describe("RFC 8785 commitment inputs", () => {
  it("sorts object keys recursively without changing array order", () => {
    expect(canonicalizeJson({ z: [3, 2, 1], a: { y: true, x: null } })).toBe(
      '{"a":{"x":null,"y":true},"z":[3,2,1]}',
    );
  });

  it("uses a stable domain-separated UTF-8 preimage", () => {
    expect(commitmentPreimage(fixture)).toBe(
      `LOZZI_COMMITMENT_V1\u0000academic-record\u000010000000-0000-4000-8000-000000000001\u0000${fixture.salt}\u0000{"course":"CS 1301","credits":3,"grade":"A","student":"urn:lozzi:student:synthetic-aisha"}`,
    );
  });

  it("changes when only the salt changes", () => {
    const other = createCommitment({
      ...fixture,
      salt: `0x${"22".repeat(32)}`,
    });
    expect(createCommitment(fixture)).not.toBe(other);
  });
});

describe("opaque institution and student commitments", () => {
  const institutionSecret = `0x${"a1".repeat(32)}` as const;
  const studentSecret = `0x${"b2".repeat(32)}` as const;

  it("matches deterministic institution and student vectors", () => {
    const institutionCommitment = createInstitutionCommitment({
      environment: "test",
      institutionId: "10000000-0000-4000-8000-000000000001",
      keyVersion: 1,
      secret: institutionSecret,
    });
    const studentCommitment = createStudentCommitment({
      environment: "test",
      institutionCommitment,
      institutionScopedSecret: studentSecret,
      keyVersion: 1,
      studentOpaqueId: "10000000-0000-4000-8000-000000000010",
    });

    expect(institutionCommitment).toBe(
      "0xa5b98bad52f1d1fafba6b626c38b3456a4b33ffa59010157e844edf4432fdb1a",
    );
    expect(studentCommitment).toBe(
      "0x1715f41bf63e67d3634302bb7286fa3383b83d4b40e9e7a9ec7a6b94900e155a",
    );
  });

  it("separates students by institution, environment, and secret", () => {
    const studentOpaqueId = "10000000-0000-4000-8000-000000000010";
    const institutionA = createInstitutionCommitment({
      environment: "test",
      institutionId: "10000000-0000-4000-8000-000000000001",
      keyVersion: 1,
      secret: institutionSecret,
    });
    const institutionB = createInstitutionCommitment({
      environment: "test",
      institutionId: "10000000-0000-4000-8000-000000000002",
      keyVersion: 1,
      secret: institutionSecret,
    });

    const baseline = createStudentCommitment({
      environment: "test",
      institutionCommitment: institutionA,
      institutionScopedSecret: studentSecret,
      keyVersion: 1,
      studentOpaqueId,
    });
    const variants = [
      createStudentCommitment({
        environment: "test",
        institutionCommitment: institutionB,
        institutionScopedSecret: studentSecret,
        keyVersion: 1,
        studentOpaqueId,
      }),
      createStudentCommitment({
        environment: "production",
        institutionCommitment: institutionA,
        institutionScopedSecret: studentSecret,
        keyVersion: 1,
        studentOpaqueId,
      }),
      createStudentCommitment({
        environment: "test",
        institutionCommitment: institutionA,
        institutionScopedSecret: `0x${"c3".repeat(32)}`,
        keyVersion: 1,
        studentOpaqueId,
      }),
    ];

    expect(new Set([institutionA, baseline, ...variants])).toHaveLength(5);
  });

  it("rejects weak commitment material", () => {
    expect(() =>
      createInstitutionCommitment({
        environment: "test",
        institutionId: "",
        keyVersion: 1,
        secret: institutionSecret,
      }),
    ).toThrow("institution ID must not be empty");
    expect(() =>
      createStudentCommitment({
        environment: "test",
        institutionCommitment: "0x1234",
        institutionScopedSecret: studentSecret,
        keyVersion: 1,
        studentOpaqueId: "student",
      }),
    ).toThrow("institution commitment must be a 32-byte hex value");
  });
});
