import {
  buildAgentkitSchema,
  createAgentBookVerifier,
  createAgentkitClient,
  formatSIWEMessage,
  parseAgentkitHeader,
  validateAgentkitMessage,
  type AgentkitExtension,
} from "@worldcoin/agentkit";
import { verifyMessage, type PublicClient } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";

import { createAgentRequestState } from "./storage";

const RESOURCE =
  "http://localhost:3000/api/agentkit/degree-plan/context" as const;

const createExtension = (overrides: {
  readonly expirationTime?: string;
  readonly issuedAt?: string;
} = {}): AgentkitExtension => ({
  info: {
    domain: "localhost",
    expirationTime:
      overrides.expirationTime ??
      new Date(Date.now() + 5 * 60 * 1_000).toISOString(),
    issuedAt: overrides.issuedAt ?? new Date().toISOString(),
    nonce: "testnonce123456",
    statement: "Read a delegated Lozzi degree-plan context",
    resources: [RESOURCE],
    uri: RESOURCE,
    version: "1",
  },
  schema: buildAgentkitSchema(),
  supportedChains: [
    {
      chainId: "eip155:480",
      signatureScheme: "eip191",
      type: "eip191",
    },
  ],
});

describe("AgentKit protocol binding", () => {
  it("signs and validates the exact World Chain resource", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const client = createAgentkitClient({
      signer: {
        address: account.address,
        chainId: "eip155:480",
        signMessage: (message) => account.signMessage({ message }),
        type: "eip191",
      },
    });
    const payload = parseAgentkitHeader(
      await client.createHeader(createExtension()),
    );

    expect(payload.chainId).toBe("eip155:480");
    expect(
      await validateAgentkitMessage(payload, RESOURCE, {
        checkNonce: () => true,
      }),
    ).toEqual({ valid: true });
    const wrongResourceState = createAgentRequestState({
      agentkitHeader: await client.createHeader(createExtension()),
      authorizationHeader: `Bearer ${"a".repeat(43)}`,
      endpoint: "/api/agentkit/degree-plan/proposals",
    });
    expect(wrongResourceState.payload).toBeNull();
    expect(
      await validateAgentkitMessage(payload, RESOURCE, {
        checkNonce: () => false,
      }),
    ).toEqual(
      expect.objectContaining({
        valid: false,
      }),
    );

    const message = formatSIWEMessage(payload, payload.address);
    expect(
      await verifyMessage({
        address: account.address,
        message,
        signature: payload.signature as `0x${string}`,
      }),
    ).toBe(true);
  });

  it("rejects an expired signed challenge", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const client = createAgentkitClient({
      signer: {
        address: account.address,
        chainId: "eip155:480",
        signMessage: (message) => account.signMessage({ message }),
        type: "eip191",
      },
    });
    const payload = parseAgentkitHeader(
      await client.createHeader(
        createExtension({
          expirationTime: new Date(Date.now() - 60_000).toISOString(),
          issuedAt: new Date(Date.now() - 6 * 60_000).toISOString(),
        }),
      ),
    );

    expect(await validateAgentkitMessage(payload, RESOURCE)).toEqual(
      expect.objectContaining({
        valid: false,
      }),
    );
  });

  it("distinguishes registered and unregistered canonical AgentBook reads", async () => {
    const readContract = vi
      .fn()
      .mockResolvedValueOnce(BigInt(123))
      .mockResolvedValueOnce(BigInt(0));
    const verifier = createAgentBookVerifier({
      client: { readContract } as unknown as PublicClient,
    });
    const address = "0x1111111111111111111111111111111111111111";

    await expect(verifier.lookupHuman(address)).resolves.toBe("0x7b");
    await expect(verifier.lookupHuman(address)).resolves.toBeNull();
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "0xA23aB2712eA7BBa896930544C7d6636a96b944dA",
        functionName: "lookupHuman",
      }),
    );
  });
});
