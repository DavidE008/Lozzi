import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  privateObjectMetadataSchema,
  type PrivateObjectMetadata,
  type PrivateStorageProvider,
} from "@lozzi/domain";
import { ethers } from "ethers";

import { getZeroGStorageConfig } from "./config";
import { PartnerIntegrationError } from "./errors";

interface StorageUploadResult {
  readonly rootHash: `0x${string}`;
  readonly transactionHash: `0x${string}`;
}

interface ZeroGStorageDriver {
  uploadAndVerify(ciphertext: Uint8Array): Promise<StorageUploadResult>;
}

const bytes32 = (value: string, label: string): `0x${string}` => {
  if (!/^0x[0-9a-fA-F]{64}$/u.test(value)) {
    throw new PartnerIntegrationError(
      "invalid-response",
      `0G returned an invalid ${label}.`,
    );
  }
  return value.toLowerCase() as `0x${string}`;
};

const sha256 = (value: Uint8Array): `0x${string}` =>
  `0x${createHash("sha256").update(value).digest("hex")}`;

const createSdkStorageDriver = (): ZeroGStorageDriver => ({
  async uploadAndVerify(ciphertext) {
    const config = getZeroGStorageConfig();
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "lozzi-0g-"));
    const objectPath = join(temporaryDirectory, "private-object.bin");
    let file:
      | Awaited<
          ReturnType<
            typeof import("@0gfoundation/0g-storage-ts-sdk").ZgFile.fromFilePath
          >
        >
      | undefined;

    try {
      await writeFile(objectPath, ciphertext, { mode: 0o600 });
      const { Indexer, ZgFile } = await import(
        "@0gfoundation/0g-storage-ts-sdk"
      );
      file = await ZgFile.fromFilePath(objectPath);
      const [tree, treeError] = await file.merkleTree();
      if (treeError || !tree) {
        throw new PartnerIntegrationError(
          "integrity",
          "0G could not calculate the encrypted object root.",
          { cause: treeError ?? undefined },
        );
      }

      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const signer = new ethers.Wallet(config.signerPrivateKey, provider);
      const indexer = new Indexer(config.indexerRpcUrl);
      const [uploadResult, uploadError] = await indexer.upload(
        file,
        config.rpcUrl,
        signer,
      );
      if (uploadError || !uploadResult || "rootHashes" in uploadResult) {
        throw new PartnerIntegrationError(
          "provider-unavailable",
          "0G Storage could not confirm the encrypted upload.",
          { cause: uploadError ?? undefined },
        );
      }
      if (!uploadResult.rootHash || !uploadResult.txHash) {
        throw new PartnerIntegrationError(
          "invalid-response",
          "0G Storage returned incomplete upload evidence.",
        );
      }

      const rootHash = bytes32(uploadResult.rootHash, "root hash");
      const calculatedRoot = tree.rootHash();
      if (
        !calculatedRoot ||
        rootHash !== bytes32(calculatedRoot, "calculated root hash")
      ) {
        throw new PartnerIntegrationError(
          "integrity",
          "0G returned a root that did not match the encrypted object.",
        );
      }

      const [verifiedBlob, downloadError] = await indexer.downloadToBlob(
        rootHash,
        { proof: true },
      );
      if (downloadError || !verifiedBlob) {
        throw new PartnerIntegrationError(
          "integrity",
          "0G could not prove the stored encrypted object.",
          { cause: downloadError ?? undefined },
        );
      }
      const verifiedBytes = new Uint8Array(await verifiedBlob.arrayBuffer());
      if (sha256(verifiedBytes) !== sha256(ciphertext)) {
        throw new PartnerIntegrationError(
          "integrity",
          "The downloaded 0G object did not match the encrypted upload.",
        );
      }

      return {
        rootHash,
        transactionHash: bytes32(uploadResult.txHash, "transaction hash"),
      };
    } finally {
      try {
        await file?.close();
      } finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
      }
    }
  },
});

export class ZeroGPrivateStorageProvider implements PrivateStorageProvider {
  readonly capability = {
    name: "zero-g" as const,
    status: "available" as const,
    label: "0G private storage",
    detail: "Encrypted 0G Storage is configured.",
  };

  constructor(
    private readonly driver: ZeroGStorageDriver = createSdkStorageDriver(),
  ) {}

  async putEncryptedObject(input: {
    readonly ciphertext: Uint8Array;
    readonly ciphertextSha256: `0x${string}`;
    readonly metadata: PrivateObjectMetadata;
    readonly wrappingKeyReference: string;
  }) {
    const metadata = privateObjectMetadataSchema.parse(input.metadata);
    if (
      sha256(input.ciphertext) !== input.ciphertextSha256.toLowerCase() ||
      metadata.ciphertextCommitment.toLowerCase() !==
        input.ciphertextSha256.toLowerCase() ||
      metadata.wrappingKeyReference !== input.wrappingKeyReference
    ) {
      throw new PartnerIntegrationError(
        "integrity",
        "Encrypted object metadata did not match its ciphertext.",
      );
    }
    const result = await this.driver.uploadAndVerify(input.ciphertext);
    return {
      objectReference: `0g://${result.rootHash}`,
      rootHash: result.rootHash,
      transactionHash: result.transactionHash,
    };
  }
}

export const createZeroGStorageProvider = () =>
  new ZeroGPrivateStorageProvider();
