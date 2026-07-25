import { describe, expect, it } from "vitest";

import {
  commitAgentAddress,
  commitAgentKitHuman,
  hashAgentKitNonce,
  hashDelegationToken,
  toPostgresBytea,
} from "./commitments";

const config = {
  humanIdHmacKey: Buffer.alloc(32, 9).toString("base64"),
};

describe("AgentKit opaque commitments", () => {
  it("separates delegation, nonce, human, and address domains", () => {
    const value = "synthetic-opaque-value";
    const commitments = [
      hashDelegationToken(value),
      hashAgentKitNonce(value),
      commitAgentKitHuman(config, value),
      commitAgentAddress(
        config,
        "0x1111111111111111111111111111111111111111",
      ),
    ];

    expect(new Set(commitments)).toHaveLength(4);
    expect(commitments.every((item) => /^0x[0-9a-f]{64}$/u.test(item))).toBe(
      true,
    );
  });

  it("normalizes an agent address before committing it", () => {
    expect(
      commitAgentAddress(
        config,
        "0x52908400098527886E0F7030069857D2E4169EE7",
      ),
    ).toBe(
      commitAgentAddress(
        config,
        "0x52908400098527886e0f7030069857d2e4169ee7",
      ),
    );
  });

  it("serializes only bounded bytes into PostgreSQL", () => {
    expect(toPostgresBytea(hashAgentKitNonce("nonce"))).toMatch(
      /^\\x[0-9a-f]{64}$/u,
    );
    expect(() => toPostgresBytea("0x01")).toThrow(TypeError);
  });
});
