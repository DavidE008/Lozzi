import "server-only";

import {
  agentkitResourceServerExtension,
  createAgentBookVerifier,
  createAgentkitHooks,
  declareAgentkitExtension,
  type AgentBookVerifier,
  type AgentKitStorage,
  type AgentkitHookEvent,
} from "@worldcoin/agentkit";
import {
  HTTPFacilitatorClient,
  type FacilitatorClient,
} from "@x402/core/http";
import { x402HTTPResourceServer, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddlewareFromHTTPServer } from "@x402/hono";
import { Hono } from "hono";
import { z } from "zod";

import {
  getAgentDegreePlanContext,
  submitAgentDegreePlanProposal,
  type AgentKitEndpoint,
} from "@/lib/agentkit/records";
import {
  agentRequestStorage,
  createAgentRequestState,
  requireAgentAuthorization,
  SupabaseAgentKitStorage,
} from "@/lib/agentkit/storage";
import {
  getAgentKitConfig,
  type AgentKitConfig,
} from "@/lib/integrations/config";
import { logEvent } from "@/lib/logging";

const WORLD_CHAIN = "eip155:480" as const;
const WORLD_USDC = "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1";
const CONTEXT_ENDPOINT = "/api/agentkit/degree-plan/context" as const;
const PROPOSALS_ENDPOINT = "/api/agentkit/degree-plan/proposals" as const;
const MAX_PROPOSAL_BODY_BYTES = 16_384;
const endpoints = new Set<AgentKitEndpoint>([
  CONTEXT_ENDPOINT,
  PROPOSALS_ENDPOINT,
]);

export class AgentRequestBodyTooLargeError extends Error {
  constructor() {
    super("The AgentKit request body is too large.");
    this.name = "AgentRequestBodyTooLargeError";
  }
}

export const readBoundedJsonBody = async (
  request: Request,
  maximumBytes = MAX_PROPOSAL_BODY_BYTES,
): Promise<unknown> => {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new AgentRequestBodyTooLargeError();
  }

  const reader = request.body?.getReader();
  if (!reader) return JSON.parse(await request.text()) as unknown;

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel();
        throw new AgentRequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body)) as unknown;
};

const proposalInputSchema = z
  .object({
    courseCodes: z
      .array(z.string().trim().min(1).max(40))
      .min(1)
      .max(12)
      .refine((items) => new Set(items).size === items.length),
    summary: z.string().trim().min(1).max(1_200),
  })
  .strict();

const onAgentKitEvent = (event: AgentkitHookEvent) => {
  logEvent(
    event.type === "validation_failed" ? "warn" : "info",
    `agentkit_${event.type}`,
    { resource: event.resource },
  );
};

interface AgentAppDependencies {
  readonly agentBook?: AgentBookVerifier;
  readonly facilitator?: FacilitatorClient;
  readonly storage?: AgentKitStorage;
}

const createHttpServer = (
  config: AgentKitConfig,
  dependencies: AgentAppDependencies,
) => {
  const facilitator =
    dependencies.facilitator ??
    new HTTPFacilitatorClient({
      url: config.facilitatorUrl,
    });
  const evmScheme = new ExactEvmScheme().registerMoneyParser(
    async (amount, network) => {
      if (network !== WORLD_CHAIN) return null;
      return {
        amount: String(Math.round(amount * 1_000_000)),
        asset: WORLD_USDC,
        extra: { name: "USD Coin", version: "2" },
      };
    },
  );
  const resourceServer = new x402ResourceServer(facilitator)
    .register(WORLD_CHAIN, evmScheme)
    .registerExtension(agentkitResourceServerExtension);
  const agentBook =
    dependencies.agentBook ??
    createAgentBookVerifier({
      rpcUrl: config.worldChainRpcUrl,
    });
  const hooks = createAgentkitHooks({
    agentBook,
    mode: { type: "free-trial", uses: 3 },
    onEvent: onAgentKitEvent,
    rpcUrl: config.worldChainRpcUrl,
    storage: dependencies.storage ?? new SupabaseAgentKitStorage(config),
  });
  const accepts = {
    scheme: "exact" as const,
    price: "$0.01" as const,
    network: WORLD_CHAIN,
    payTo: config.agentAddress,
  };
  const extension = declareAgentkitExtension({
    expirationSeconds: 300,
    mode: { type: "free-trial", uses: 3 },
    network: WORLD_CHAIN,
    statement:
      "Use a student-authorized Lozzi delegation to propose a degree plan",
  });
  const httpServer = new x402HTTPResourceServer(resourceServer, {
    [`GET ${CONTEXT_ENDPOINT}`]: {
      accepts,
      description: "Read a minimized, delegated degree-plan context",
      extensions: extension,
      mimeType: "application/json",
    },
    [`POST ${PROPOSALS_ENDPOINT}`]: {
      accepts,
      description: "Submit a pending degree-plan proposal for advisor review",
      extensions: extension,
      mimeType: "application/json",
    },
  });
  return httpServer.onProtectedRequest(hooks.requestHook);
};

export const createDegreePlanAgentApp = (
  config: AgentKitConfig = getAgentKitConfig(),
  dependencies: AgentAppDependencies = {},
) => {
  const app = new Hono();
  const httpServer = createHttpServer(config, dependencies);

  app.use("/api/agentkit/*", async (context, next) => {
    const endpoint = context.req.path as AgentKitEndpoint;
    if (!endpoints.has(endpoint)) return next();
    try {
      const state = createAgentRequestState({
        agentkitHeader: context.req.header("agentkit"),
        authorizationHeader: context.req.header("authorization"),
        endpoint,
      });
      return agentRequestStorage.run(state, () => next());
    } catch {
      return context.json(
        { error: "A valid, short-lived student delegation is required." },
        401,
      );
    }
  });

  app.use(
    "/api/agentkit/*",
    paymentMiddlewareFromHTTPServer(httpServer, undefined, undefined, true),
  );

  app.get(CONTEXT_ENDPOINT, async (context) => {
    try {
      const authorization = requireAgentAuthorization("degree-plan:read");
      const degreePlan = await getAgentDegreePlanContext(authorization);
      context.header("cache-control", "no-store");
      return context.json(degreePlan);
    } catch {
      return context.json({ error: "Degree-plan context is unavailable." }, 403);
    }
  });

  app.post(PROPOSALS_ENDPOINT, async (context) => {
    try {
      const authorization = requireAgentAuthorization("degree-plan:propose");
      const input = proposalInputSchema.parse(
        await readBoundedJsonBody(context.req.raw),
      );
      const proposal = await submitAgentDegreePlanProposal(
        authorization,
        input,
      );
      context.header("cache-control", "no-store");
      return context.json(proposal, 201);
    } catch (error) {
      if (error instanceof AgentRequestBodyTooLargeError) {
        return context.json({ error: "Proposal request is too large." }, 413);
      }
      return context.json(
        { error: "The degree-plan proposal could not be submitted." },
        400,
      );
    }
  });

  return app;
};

let cachedApp: ReturnType<typeof createDegreePlanAgentApp> | undefined;

export const getDegreePlanAgentApp = () => {
  cachedApp ??= createDegreePlanAgentApp();
  return cachedApp;
};
