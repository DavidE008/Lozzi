import { describe, expect, it } from "vitest";

import {
  canonicalizeJson,
  commitmentPreimage,
  createCommitment,
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
    const other = createCommitment({ ...fixture, salt: `0x${"22".repeat(32)}` });
    expect(createCommitment(fixture)).not.toBe(other);
  });
});
