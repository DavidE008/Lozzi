import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  decryptPrivateJsonForTest,
  encryptPrivateJson,
} from "./private-envelope";

describe("private object envelope", () => {
  it("round-trips canonical JSON through per-object AES-256-GCM", () => {
    const masterKey = randomBytes(32).toString("base64");
    const payload = {
      student: "synthetic-aisha",
      requirements: [{ status: "complete", code: "CS 1301" }],
    };
    const encrypted = encryptPrivateJson(payload, {
      institutionId: "10000000-0000-4000-8000-000000000001",
      keyWrappingMasterKey: masterKey,
      objectType: "degree-audit-context",
    });

    expect(decryptPrivateJsonForTest(encrypted.bytes, masterKey)).toEqual({
      requirements: [{ code: "CS 1301", status: "complete" }],
      student: "synthetic-aisha",
    });
    expect(encrypted.metadata.encryptionMode).toBe("aes-256-gcm");
    expect(encrypted.metadata.wrappingKeyReference).not.toContain(masterKey);
  });

  it("uses fresh object keys and IVs for the same payload", () => {
    const masterKey = randomBytes(32).toString("base64");
    const input = {
      institutionId: "10000000-0000-4000-8000-000000000001",
      keyWrappingMasterKey: masterKey,
      objectType: "academic-record-snapshot" as const,
    };
    const first = encryptPrivateJson({ credits: 3 }, input);
    const second = encryptPrivateJson({ credits: 3 }, input);

    expect(first.ciphertextSha256).not.toBe(second.ciphertextSha256);
    expect(first.metadata.iv).not.toBe(second.metadata.iv);
  });

  it("fails closed with the wrong wrapping key", () => {
    const encrypted = encryptPrivateJson(
      { credits: 3 },
      {
        institutionId: "10000000-0000-4000-8000-000000000001",
        keyWrappingMasterKey: randomBytes(32).toString("base64"),
        objectType: "academic-record-snapshot",
      },
    );

    expect(() =>
      decryptPrivateJsonForTest(
        encrypted.bytes,
        randomBytes(32).toString("base64"),
      ),
    ).toThrow();
  });
});
