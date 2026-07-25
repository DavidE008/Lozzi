import { keccak256, stringToHex } from "viem";

const DOMAIN_PREFIX = "LOZZI_COMMITMENT_V1";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface CommitmentInput {
  readonly domain: "academic-record" | "share-grant" | "student";
  readonly institutionId: string;
  readonly salt: `0x${string}`;
  readonly payload: JsonValue;
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
