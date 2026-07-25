import { randomBytes } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { encryptPrivateJson } from "./private-envelope";
import { ZeroGPrivateStorageProvider } from "./zero-g-storage";

describe("0G private storage provider", () => {
  it("uploads only an encrypted envelope and returns durable evidence", async () => {
    const encrypted = encryptPrivateJson(
      { student: "synthetic-aisha", credits: 3 },
      {
        institutionId: "10000000-0000-4000-8000-000000000001",
        keyWrappingMasterKey: randomBytes(32).toString("base64"),
        objectType: "degree-audit-context",
      },
    );
    const driver = {
      uploadAndVerify: vi.fn().mockResolvedValue({
        rootHash: `0x${"22".repeat(32)}`,
        transactionHash: `0x${"33".repeat(32)}`,
      }),
    };
    const provider = new ZeroGPrivateStorageProvider(driver);

    await expect(
      provider.putEncryptedObject({
        ciphertext: encrypted.bytes,
        ciphertextSha256: encrypted.ciphertextSha256,
        metadata: encrypted.metadata,
        wrappingKeyReference: encrypted.metadata.wrappingKeyReference,
      }),
    ).resolves.toEqual({
      objectReference: `0g://0x${"22".repeat(32)}`,
      rootHash: `0x${"22".repeat(32)}`,
      transactionHash: `0x${"33".repeat(32)}`,
    });
    expect(driver.uploadAndVerify).toHaveBeenCalledWith(encrypted.bytes);
    expect(Buffer.from(encrypted.bytes).toString("utf8")).not.toContain(
      "synthetic-aisha",
    );
  });

  it("rejects mismatched ciphertext metadata before upload", async () => {
    const encrypted = encryptPrivateJson(
      { credits: 3 },
      {
        institutionId: "10000000-0000-4000-8000-000000000001",
        keyWrappingMasterKey: randomBytes(32).toString("base64"),
        objectType: "degree-audit-context",
      },
    );
    const driver = { uploadAndVerify: vi.fn() };

    await expect(
      new ZeroGPrivateStorageProvider(driver).putEncryptedObject({
        ciphertext: encrypted.bytes,
        ciphertextSha256: `0x${"44".repeat(32)}`,
        metadata: encrypted.metadata,
        wrappingKeyReference: encrypted.metadata.wrappingKeyReference,
      }),
    ).rejects.toMatchObject({ category: "integrity" });
    expect(driver.uploadAndVerify).not.toHaveBeenCalled();
  });
});
