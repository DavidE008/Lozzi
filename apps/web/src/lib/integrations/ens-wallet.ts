import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import {
  createPublicClient,
  getAddress,
  http,
  sha256,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";
import {
  createSiweMessage,
  parseSiweMessage,
} from "viem/siwe";

import { getEnsWalletLinkConfig } from "./config";
import {
  consumeWalletLinkChallengeRecord,
  createWalletLinkChallengeRecord,
  getWalletLinkChallengeRecord,
  type StoredWalletLinkChallenge,
} from "./ens-records";
import { PartnerIntegrationError } from "./errors";

const WALLET_LINK_STATEMENT =
  "Link this Sepolia wallet to Lozzi. This does not publish an ENS name.";
const WALLET_LINK_RESOURCE = "urn:lozzi:wallet-link:v1";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const hashText = (value: string): Hex => sha256(toBytes(value));

export const buildWalletLinkMessage = (input: {
  readonly address: Address;
  readonly appUrl: string;
  readonly challengeId: string;
  readonly expiresAt: Date;
  readonly issuedAt: Date;
  readonly nonce: string;
}): { readonly domain: string; readonly message: string; readonly uri: string } => {
  const appUrl = new URL(input.appUrl);
  const uri = new URL("/student/settings", appUrl).toString();
  return {
    domain: appUrl.host,
    message: createSiweMessage({
      address: getAddress(input.address),
      chainId: sepolia.id,
      domain: appUrl.host,
      expirationTime: input.expiresAt,
      issuedAt: input.issuedAt,
      nonce: input.nonce,
      requestId: input.challengeId,
      resources: [WALLET_LINK_RESOURCE],
      scheme: appUrl.protocol.slice(0, -1),
      statement: WALLET_LINK_STATEMENT,
      uri,
      version: "1",
    }),
    uri,
  };
};

export const assertWalletLinkMessage = (input: {
  readonly challenge: StoredWalletLinkChallenge;
  readonly message: string;
  readonly now?: Date;
}): { readonly address: Address; readonly nonce: string } => {
  if (hashText(input.message).toLowerCase() !== input.challenge.messageHash.toLowerCase()) {
    throw new PartnerIntegrationError(
      "integrity",
      "The wallet signature message did not match its one-time challenge.",
    );
  }

  const parsed = parseSiweMessage(input.message);
  const now = input.now ?? new Date();
  if (
    !parsed.address ||
    !parsed.nonce ||
    parsed.chainId !== sepolia.id ||
    parsed.domain !== input.challenge.domain ||
    parsed.uri !== input.challenge.uri ||
    parsed.requestId !== input.challenge.challengeId ||
    parsed.statement !== WALLET_LINK_STATEMENT ||
    parsed.version !== "1" ||
    !parsed.resources?.includes(WALLET_LINK_RESOURCE) ||
    !parsed.issuedAt ||
    !parsed.expirationTime ||
    parsed.issuedAt.toISOString() !== input.challenge.issuedAt ||
    parsed.expirationTime.toISOString() !== input.challenge.expiresAt ||
    parsed.expirationTime <= now ||
    hashText(parsed.nonce).toLowerCase() !== input.challenge.nonceHash.toLowerCase() ||
    getAddress(parsed.address) !== getAddress(input.challenge.address)
  ) {
    throw new PartnerIntegrationError(
      "integrity",
      "The wallet signature used the wrong account, network, origin, or challenge.",
    );
  }

  return { address: getAddress(parsed.address), nonce: parsed.nonce };
};

export const createWalletLinkChallenge = async (input: {
  readonly address: `0x${string}`;
  readonly studentId: string;
}) => {
  const config = getEnsWalletLinkConfig();
  const address = getAddress(input.address);
  const challengeId = randomUUID();
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);
  const built = buildWalletLinkMessage({
    address,
    appUrl: config.appUrl,
    challengeId,
    expiresAt,
    issuedAt,
    nonce,
  });

  await createWalletLinkChallengeRecord({
    address,
    challengeId,
    domain: built.domain,
    expiresAt: expiresAt.toISOString(),
    issuedAt: issuedAt.toISOString(),
    messageHash: hashText(built.message),
    nonceHash: hashText(nonce),
    studentId: input.studentId,
    uri: built.uri,
  });

  return {
    challengeId,
    expiresAt: expiresAt.toISOString(),
    message: built.message,
  };
};

export const verifyWalletLinkChallenge = async (input: {
  readonly challengeId: string;
  readonly message: string;
  readonly signature: Hex;
  readonly studentId: string;
}) => {
  const challenge = await getWalletLinkChallengeRecord(
    input.challengeId,
    input.studentId,
  );
  if (!challenge) {
    throw new PartnerIntegrationError(
      "replay",
      "The wallet-link challenge is invalid, expired, or already used.",
    );
  }
  const expected = assertWalletLinkMessage({
    challenge,
    message: input.message,
  });
  const config = getEnsWalletLinkConfig();
  const appUrl = new URL(config.appUrl);
  const client = createPublicClient({
    chain: sepolia,
    transport: http(config.readRpcUrl),
  });
  const valid = await client.verifySiweMessage({
    address: expected.address,
    domain: challenge.domain,
    message: input.message,
    nonce: expected.nonce,
    scheme: appUrl.protocol.slice(0, -1),
    signature: input.signature,
    time: new Date(),
  });
  if (!valid) {
    throw new PartnerIntegrationError(
      "authentication",
      "The wallet signature could not be verified.",
    );
  }

  return consumeWalletLinkChallengeRecord({
    address: expected.address,
    challengeId: challenge.challengeId,
    messageHash: hashText(input.message),
    studentId: input.studentId,
    verifiedAt: new Date().toISOString(),
  });
};
