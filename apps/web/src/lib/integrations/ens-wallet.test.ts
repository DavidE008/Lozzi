import { describe, expect, it } from "vitest";
import { sha256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import {
  assertWalletLinkMessage,
  buildWalletLinkMessage,
} from "./ens-wallet";

const account = privateKeyToAccount(`0x${"11".repeat(32)}`);
const issuedAt = new Date("2026-07-25T12:00:00.000Z");
const expiresAt = new Date("2026-07-25T12:05:00.000Z");
const challengeId = "11111111-1111-4111-8111-111111111111";
const nonce = "12345678abcdef00";

describe("ENS wallet linking", () => {
  it("builds a Sepolia-bound ERC-4361 message without ENS publication consent", () => {
    const built = buildWalletLinkMessage({
      address: account.address,
      appUrl: "https://lozzi.example",
      challengeId,
      expiresAt,
      issuedAt,
      nonce,
    });

    expect(built.message).toContain("Chain ID: 11155111");
    expect(built.message).toContain(`Request ID: ${challengeId}`);
    expect(built.message).toContain("This does not publish an ENS name.");
    expect(built.uri).toBe("https://lozzi.example/student/settings");
  });

  it("rejects a message whose immutable challenge hash differs", () => {
    const built = buildWalletLinkMessage({
      address: account.address,
      appUrl: "https://lozzi.example",
      challengeId,
      expiresAt,
      issuedAt,
      nonce,
    });

    expect(() =>
      assertWalletLinkMessage({
        challenge: {
          address: account.address,
          challengeId,
          domain: built.domain,
          expiresAt: expiresAt.toISOString(),
          issuedAt: issuedAt.toISOString(),
          messageHash: `0x${"22".repeat(32)}`,
          nonceHash: `0x${"33".repeat(32)}`,
          uri: built.uri,
        },
        message: built.message,
        now: new Date("2026-07-25T12:01:00.000Z"),
      }),
    ).toThrow(/did not match/u);
  });

  it("accepts the exact unexpired origin-bound challenge", () => {
    const built = buildWalletLinkMessage({
      address: account.address,
      appUrl: "https://lozzi.example",
      challengeId,
      expiresAt,
      issuedAt,
      nonce,
    });

    expect(
      assertWalletLinkMessage({
        challenge: {
          address: account.address,
          challengeId,
          domain: built.domain,
          expiresAt: expiresAt.toISOString(),
          issuedAt: issuedAt.toISOString(),
          messageHash: sha256(toBytes(built.message)),
          nonceHash: sha256(toBytes(nonce)),
          uri: built.uri,
        },
        message: built.message,
        now: new Date("2026-07-25T12:01:00.000Z"),
      }),
    ).toEqual({ address: account.address, nonce });
  });
});
