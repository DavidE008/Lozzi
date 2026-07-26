import { concatHex, keccak256, stringToHex } from "viem";

const DOMAIN_PREFIX = "LOZZI_COMMITMENT_V1";
const OPAQUE_INSTITUTION_DOMAIN = "LOZZI_INSTITUTION_COMMITMENT_V1";
const OPAQUE_STUDENT_DOMAIN = "LOZZI_STUDENT_COMMITMENT_V1";

export const INSTITUTION_COMMITMENT_ALGORITHM = "lozzi-institution-v1";
export const STUDENT_COMMITMENT_ALGORITHM = "lozzi-student-v1";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface CommitmentInput {
  readonly domain:
    | "academic-record"
    | "ai-request"
    | "ai-response"
    | "private-object"
    | "share-grant"
    | "student";
  readonly institutionId: string;
  readonly salt: `0x${string}`;
  readonly payload: JsonValue;
}

export interface InstitutionCommitmentInput {
  readonly environment: string;
  readonly institutionId: string;
  readonly keyVersion: number;
  readonly secret: `0x${string}`;
}

export interface StudentCommitmentInput {
  readonly environment: string;
  readonly institutionCommitment: `0x${string}`;
  readonly institutionScopedSecret: `0x${string}`;
  readonly keyVersion: number;
  readonly studentOpaqueId: string;
}

const canonicalizeValue = (value: JsonValue): string => {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("RFC 8785 does not permit non-finite numbers");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeValue).join(",")}]`;
  }
  const entries = Object.entries(value as Readonly<Record<string, JsonValue>>)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalizeValue(item)}`);
  return `{${entries.join(",")}}`;
};

export const canonicalizeJson = (value: JsonValue): string =>
  canonicalizeValue(value);

export const commitmentPreimage = ({
  domain,
  institutionId,
  salt,
  payload,
}: CommitmentInput): string =>
  [
    DOMAIN_PREFIX,
    domain,
    institutionId,
    salt.toLowerCase(),
    canonicalizeJson(payload),
  ].join("\u0000");

export const createCommitment = (input: CommitmentInput): `0x${string}` =>
  keccak256(stringToHex(commitmentPreimage(input)));

const requireNonEmpty = (value: string, label: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new TypeError(`${label} must not be empty`);
  }
  return normalized;
};

const requireBytes32 = (value: `0x${string}`, label: string): `0x${string}` => {
  if (!/^0x[0-9a-fA-F]{64}$/u.test(value)) {
    throw new TypeError(`${label} must be a 32-byte hex value`);
  }
  return value.toLowerCase() as `0x${string}`;
};

const requireKeyVersion = (value: number): string => {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError("commitment key version must be a positive integer");
  }
  return String(value);
};

const createSecretBoundCommitment = (
  domain: string,
  secret: `0x${string}`,
  fields: readonly string[],
): `0x${string}` => {
  const preimage = [domain, ...fields].join("\u0000");
  return keccak256(
    concatHex([
      requireBytes32(secret, "commitment secret"),
      stringToHex(preimage),
    ]),
  );
};

export const createInstitutionCommitment = ({
  environment,
  institutionId,
  keyVersion,
  secret,
}: InstitutionCommitmentInput): `0x${string}` =>
  createSecretBoundCommitment(OPAQUE_INSTITUTION_DOMAIN, secret, [
    requireNonEmpty(environment, "environment"),
    requireKeyVersion(keyVersion),
    requireNonEmpty(institutionId, "institution ID"),
  ]);

export const createStudentCommitment = ({
  environment,
  institutionCommitment,
  institutionScopedSecret,
  keyVersion,
  studentOpaqueId,
}: StudentCommitmentInput): `0x${string}` =>
  createSecretBoundCommitment(OPAQUE_STUDENT_DOMAIN, institutionScopedSecret, [
    requireNonEmpty(environment, "environment"),
    requireKeyVersion(keyVersion),
    requireBytes32(institutionCommitment, "institution commitment"),
    requireNonEmpty(studentOpaqueId, "student opaque ID"),
  ]);
