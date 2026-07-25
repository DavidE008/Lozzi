import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import {
  parseAgentkitHeader,
  type AgentkitPayload,
  type AgentKitStorage,
} from "@worldcoin/agentkit";

import {
  commitAgentAddress,
  commitAgentKitHuman,
  hashAgentKitNonce,
  hashDelegationToken,
  type Bytes32,
} from "@/lib/agentkit/commitments";
import {
  authorizeAgentDelegation,
  hasAgentKitNonce,
  type AgentAuthorization,
  type AgentKitEndpoint,
  type AgentKitScope,
} from "@/lib/agentkit/records";
import type { AgentKitConfig } from "@/lib/integrations/config";

interface AgentRequestState {
  readonly endpoint: AgentKitEndpoint;
  readonly payload: AgentkitPayload | null;
  readonly tokenHash: Bytes32;
  authorization?: AgentAuthorization;
  recordedNonce?: string;
}

interface StorageDependencies {
  readonly authorize: typeof authorizeAgentDelegation;
  readonly hasNonce: typeof hasAgentKitNonce;
}

const endpointScopes: Readonly<Record<AgentKitEndpoint, AgentKitScope>> = {
  "/api/agentkit/degree-plan/context": "degree-plan:read",
  "/api/agentkit/degree-plan/proposals": "degree-plan:propose",
};

export const agentRequestStorage = new AsyncLocalStorage<AgentRequestState>();

const bearerToken = (authorization: string | undefined): string => {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/u.exec(authorization ?? "");
  if (!match?.[1]) throw new TypeError("A bounded delegation token is required");
  return match[1];
};

const parsePayload = (
  header: string | undefined,
  endpoint: AgentKitEndpoint,
): AgentkitPayload | null => {
  if (!header) return null;
  try {
    const payload = parseAgentkitHeader(header);
    const resource = new URL(payload.uri);
    if (
      resource.pathname !== endpoint ||
      resource.search ||
      resource.hash ||
      !payload.resources?.includes(payload.uri)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

export const createAgentRequestState = (input: {
  readonly agentkitHeader: string | undefined;
  readonly authorizationHeader: string | undefined;
  readonly endpoint: AgentKitEndpoint;
}): AgentRequestState => ({
  endpoint: input.endpoint,
  payload: parsePayload(input.agentkitHeader, input.endpoint),
  tokenHash: hashDelegationToken(bearerToken(input.authorizationHeader)),
});

const nonceExpiry = (
  payload: AgentkitPayload,
  now = new Date(),
): string => {
  const maximum = now.getTime() + 10 * 60 * 1_000;
  const requested = payload.expirationTime
    ? Date.parse(payload.expirationTime)
    : now.getTime() + 5 * 60 * 1_000;
  return new Date(Math.min(requested, maximum)).toISOString();
};

export class SupabaseAgentKitStorage implements AgentKitStorage {
  constructor(
    private readonly config: AgentKitConfig,
    private readonly dependencies: StorageDependencies = {
      authorize: authorizeAgentDelegation,
      hasNonce: hasAgentKitNonce,
    },
  ) {}

  async hasUsedNonce(nonce: string): Promise<boolean> {
    return this.dependencies.hasNonce(hashAgentKitNonce(nonce));
  }

  async recordNonce(nonce: string): Promise<void> {
    const state = agentRequestStorage.getStore();
    if (!state?.payload || state.payload.nonce !== nonce) {
      throw new Error("AgentKit nonce was not bound to this request.");
    }
    state.recordedNonce = nonce;
  }

  async tryIncrementUsage(
    endpoint: string,
    humanId: string,
    limit: number,
  ): Promise<boolean> {
    const state = agentRequestStorage.getStore();
    if (
      limit !== 3 ||
      !state?.payload ||
      endpoint !== state.endpoint ||
      state.recordedNonce !== state.payload.nonce
    ) {
      return false;
    }

    const humanIdCommitment = commitAgentKitHuman(this.config, humanId);
    try {
      const authorization = await this.dependencies.authorize({
        agentAddressCommitment: commitAgentAddress(
          this.config,
          state.payload.address,
        ),
        endpoint: state.endpoint,
        humanIdCommitment,
        nonceExpiresAt: nonceExpiry(state.payload),
        nonceHash: hashAgentKitNonce(state.payload.nonce),
        scope: endpointScopes[state.endpoint],
        tokenHash: state.tokenHash,
      });
      state.authorization = { ...authorization, humanIdCommitment };
      return true;
    } catch {
      return false;
    }
  }
}

export const requireAgentAuthorization = (
  scope: AgentKitScope,
): AgentAuthorization => {
  const authorization = agentRequestStorage.getStore()?.authorization;
  if (!authorization || authorization.scope !== scope) {
    throw new Error("A verified, delegated AgentKit request is required.");
  }
  return authorization;
};
