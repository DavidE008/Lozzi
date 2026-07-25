import { describe, expect, it } from "vitest";
import type { FacilitatorClient } from "@x402/core/http";
import { decodePaymentRequiredHeader } from "@x402/core/http";

import { createDegreePlanAgentApp } from "./hono-app";

const config = {
  agentAddress: "0x1111111111111111111111111111111111111111",
  appUrl: "http://localhost:3000",
  facilitatorUrl: "https://facilitator.example",
  humanIdHmacKey: Buffer.alloc(32, 4).toString("base64"),
  worldChainRpcUrl: "https://worldchain.example",
};

const facilitator: FacilitatorClient = {
  getSupported: async () => ({
    extensions: [],
    kinds: [
      {
        network: "eip155:480",
        scheme: "exact",
        x402Version: 2,
      },
    ],
    signers: {},
  }),
  settle: async () => {
    throw new Error("Settlement is not exercised in this test.");
  },
  verify: async () => {
    throw new Error("Payment verification is not exercised in this test.");
  },
};

describe("degree-plan Hono/x402 surface", () => {
  it("requires a short-lived student delegation before x402 processing", async () => {
    const response = await createDegreePlanAgentApp(config, {
      facilitator,
    }).request(
      "/api/agentkit/degree-plan/context",
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "A valid, short-lived student delegation is required.",
    });
  });

  it("advertises a three-use AgentKit trial on World Chain", async () => {
    const response = await createDegreePlanAgentApp(config, {
      facilitator,
    }).request(
      "/api/agentkit/degree-plan/context",
      {
        headers: {
          authorization: `Bearer ${"a".repeat(43)}`,
        },
      },
    );
    const encodedPaymentRequired = response.headers.get("payment-required");
    expect(encodedPaymentRequired).not.toBeNull();
    const body = decodePaymentRequiredHeader(encodedPaymentRequired!) as {
      readonly accepts?: ReadonlyArray<{ readonly network?: string }>;
      readonly extensions?: {
        readonly agentkit?: {
          readonly info?: { readonly uri?: string };
          readonly mode?: { readonly type?: string; readonly uses?: number };
          readonly supportedChains?: ReadonlyArray<{
            readonly chainId?: string;
          }>;
        };
      };
    };

    expect(response.status).toBe(402);
    expect(body.extensions?.agentkit?.mode).toEqual({
      type: "free-trial",
      uses: 3,
    });
    expect(body.extensions?.agentkit?.supportedChains).toContainEqual(
      expect.objectContaining({ chainId: "eip155:480" }),
    );
    expect(body.extensions?.agentkit?.info?.uri).toBe(
      "http://localhost/api/agentkit/degree-plan/context",
    );
  });
});
