import "server-only";

import { createHash, createHmac } from "node:crypto";

import { getAddress } from "viem";

import type { AgentKitConfig } from "@/lib/integrations/config";

export type Bytes32 = `0x${string}`;

const bytes32 = (value: Buffer): Bytes32 => `0x${value.toString("hex")}`;

const hashOpaqueValue = (domain: string, value: string): Bytes32 =>
  bytes32(
    createHash("sha256")
      .update(`lozzi-agentkit-v1:${domain}:`, "utf8")
      .update(value, "utf8")
      .digest(),
  );

const hmacOpaqueValue = (
  config: Pick<AgentKitConfig, "humanIdHmacKey">,
  domain: string,
  value: string,
): Bytes32 =>
  bytes32(
    createHmac("sha256", Buffer.from(config.humanIdHmacKey, "base64"))
      .update(`lozzi-agentkit-v1:${domain}:`, "utf8")
      .update(value, "utf8")
      .digest(),
  );

export const hashDelegationToken = (token: string): Bytes32 =>
  hashOpaqueValue("delegation-token", token);

export const hashAgentKitNonce = (nonce: string): Bytes32 =>
  hashOpaqueValue("nonce", nonce);

export const commitAgentKitHuman = (
  config: Pick<AgentKitConfig, "humanIdHmacKey">,
  humanId: string,
): Bytes32 => hmacOpaqueValue(config, "human", humanId);

export const commitAgentAddress = (
  config: Pick<AgentKitConfig, "humanIdHmacKey">,
  address: string,
): Bytes32 =>
  hmacOpaqueValue(config, "agent-address", getAddress(address).toLowerCase());

export const toPostgresBytea = (value: Bytes32): string => {
  if (!/^0x[0-9a-fA-F]{64}$/u.test(value)) {
    throw new TypeError("Expected a 32-byte hexadecimal value");
  }
  return `\\x${value.slice(2)}`;
};
