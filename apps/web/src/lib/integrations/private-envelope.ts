import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

import {
  canonicalizeJson,
  privateObjectMetadataSchema,
  type PrivateObjectMetadata,
} from "@lozzi/domain";

type PrivateJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly PrivateJsonValue[]
  | { readonly [key: string]: PrivateJsonValue };

interface PrivateEnvelopeV1 {
  readonly aad: string;
  readonly ciphertext: string;
  readonly iv: string;
  readonly keyWrapIv: string;
  readonly keyWrapTag: string;
  readonly objectType: PrivateObjectMetadata["objectType"];
  readonly tag: string;
  readonly version: 1;
  readonly wrappedKey: string;
}

export interface EncryptedPrivateObject {
  readonly bytes: Uint8Array;
  readonly ciphertextSha256: `0x${string}`;
  readonly metadata: PrivateObjectMetadata;
}

const sha256Hex = (value: Uint8Array | string): `0x${string}` =>
  `0x${createHash("sha256").update(value).digest("hex")}`;

const encryptGcm = (
  plaintext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
  additionalData: Uint8Array,
) => {
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(additionalData);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  return { ciphertext, tag: cipher.getAuthTag() };
};

export const encryptPrivateJson = (
  payload: PrivateJsonValue,
  input: {
    readonly institutionId: string;
    readonly keyWrappingMasterKey: string;
    readonly objectType: PrivateObjectMetadata["objectType"];
    readonly ownerId: string;
  },
): EncryptedPrivateObject => {
  const wrappingKey = Buffer.from(input.keyWrappingMasterKey, "base64");
  if (wrappingKey.length !== 32) {
    throw new TypeError("Key-wrapping key must contain exactly 32 bytes");
  }

  const objectKey = randomBytes(32);
  const iv = randomBytes(12);
  const keyWrapIv = randomBytes(12);
  const ownerContext = createHmac("sha256", wrappingKey)
    .update(
      ["LOZZI_PRIVATE_OBJECT_OWNER_V1", input.institutionId, input.ownerId].join(
        "\u0000",
      ),
      "utf8",
    )
    .digest("hex");
  const aad = Buffer.from(
    [
      "LOZZI_PRIVATE_OBJECT_V1",
      input.institutionId,
      input.objectType,
      ownerContext,
    ].join("\u0000"),
    "utf8",
  );
  const plaintext = Buffer.from(canonicalizeJson(payload), "utf8");
  const encrypted = encryptGcm(plaintext, objectKey, iv, aad);
  const wrapped = encryptGcm(
    objectKey,
    wrappingKey,
    keyWrapIv,
    Buffer.from("LOZZI_OBJECT_KEY_WRAP_V1", "utf8"),
  );

  const envelope: PrivateJsonValue = {
    aad: aad.toString("base64"),
    ciphertext: encrypted.ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    keyWrapIv: keyWrapIv.toString("base64"),
    keyWrapTag: wrapped.tag.toString("base64"),
    objectType: input.objectType,
    tag: encrypted.tag.toString("base64"),
    version: 1,
    wrappedKey: wrapped.ciphertext.toString("base64"),
  };
  const bytes = Buffer.from(canonicalizeJson(envelope), "utf8");
  const ciphertextSha256 = sha256Hex(bytes);
  const wrappingKeyReference = `env-kek:v1:${sha256Hex(wrapped.ciphertext).slice(2, 34)}`;

  return {
    bytes,
    ciphertextSha256,
    metadata: privateObjectMetadataSchema.parse({
      additionalDataCommitment: sha256Hex(aad),
      ciphertextCommitment: ciphertextSha256,
      encryptionMode: "aes-256-gcm",
      iv: `0x${iv.toString("hex")}`,
      objectType: input.objectType,
      wrappingKeyReference,
    }),
  };
};

export const decryptPrivateJsonForTest = (
  encryptedBytes: Uint8Array,
  keyWrappingMasterKey: string,
): unknown => {
  const envelope = JSON.parse(
    Buffer.from(encryptedBytes).toString("utf8"),
  ) as PrivateEnvelopeV1;
  const wrappingKey = Buffer.from(keyWrappingMasterKey, "base64");
  const keyDecipher = createDecipheriv(
    "aes-256-gcm",
    wrappingKey,
    Buffer.from(envelope.keyWrapIv, "base64"),
  );
  keyDecipher.setAAD(Buffer.from("LOZZI_OBJECT_KEY_WRAP_V1", "utf8"));
  keyDecipher.setAuthTag(Buffer.from(envelope.keyWrapTag, "base64"));
  const objectKey = Buffer.concat([
    keyDecipher.update(Buffer.from(envelope.wrappedKey, "base64")),
    keyDecipher.final(),
  ]);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    objectKey,
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAAD(Buffer.from(envelope.aad, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8")) as unknown;
};
