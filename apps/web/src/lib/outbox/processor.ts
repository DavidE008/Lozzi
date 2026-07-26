import "server-only";

import { z } from "zod";

import { createOutboxRepository } from "./repository";
import {
  outboxWorkerOutcomeSchema,
  type ClaimedOutboxEvent,
  type OutboxRepository,
  type OutboxWorkerHandlers,
  type OutboxWorkerOutcome,
  type OutboxWorkerPhase,
} from "./types";

const enabledConfigSchema = z
  .object({
    batchSize: z.coerce.number().int().min(1).max(50).default(10),
    enabled: z.literal(true),
    leaseSeconds: z.coerce.number().int().min(5).max(300).default(60),
    workerId: z
      .string()
      .min(3)
      .max(120)
      .regex(/^[A-Za-z0-9._:-]+$/u),
  })
  .strict();

export type OutboxWorkerConfig =
  | Readonly<{ enabled: false }>
  | Readonly<z.infer<typeof enabledConfigSchema>>;

export type OutboxBatchResult = Readonly<{
  claimed: number;
  completed: number;
  failed: number;
  phase: OutboxWorkerPhase;
  stopped: boolean;
}>;

export const getOutboxWorkerConfig = (
  source: Readonly<Record<string, string | undefined>> = process.env,
): OutboxWorkerConfig => {
  if (source.M6_OUTBOX_WORKER_ENABLED !== "1") return { enabled: false };

  return enabledConfigSchema.parse({
    batchSize: source.M6_OUTBOX_WORKER_BATCH_SIZE ?? "10",
    enabled: true,
    leaseSeconds: source.M6_OUTBOX_WORKER_LEASE_SECONDS ?? "60",
    workerId: source.M6_OUTBOX_WORKER_ID,
  });
};

export const calculateRetryDelaySeconds = (
  attemptNumber: number,
  random: () => number = Math.random,
  options: Readonly<{
    baseSeconds?: number;
    jitterRatio?: number;
    maximumSeconds?: number;
  }> = {},
): number => {
  const baseSeconds = options.baseSeconds ?? 5;
  const jitterRatio = options.jitterRatio ?? 0.2;
  const maximumSeconds = options.maximumSeconds ?? 900;
  const exponent = Math.max(0, Math.min(attemptNumber - 1, 30));
  const withoutJitter = Math.min(
    maximumSeconds,
    baseSeconds * 2 ** exponent,
  );
  const normalizedRandom = Math.max(0, Math.min(random(), 1));
  const multiplier =
    1 - jitterRatio + normalizedRandom * jitterRatio * 2;

  return Math.max(
    1,
    Math.min(maximumSeconds, Math.round(withoutJitter * multiplier)),
  );
};

const safeFailureOutcome = (
  claim: ClaimedOutboxEvent,
  random: () => number,
  errorCode: string,
): OutboxWorkerOutcome => ({
  classification: "retryable",
  errorCode,
  retryAfterSeconds: calculateRetryDelaySeconds(claim.attemptNumber, random),
});

const completeSafely = async (
  repository: OutboxRepository,
  claim: ClaimedOutboxEvent,
  outcome: OutboxWorkerOutcome,
) => {
  await repository.complete(claim, outboxWorkerOutcomeSchema.parse(outcome));
};

const outcomeMatchesPhase = (
  phase: OutboxWorkerPhase,
  classification: OutboxWorkerOutcome["classification"],
) =>
  phase === "submission"
    ? ![
        "completed",
        "confirmation_pending",
        "reconciliation_failed",
      ].includes(classification)
    : ![
        "simulation_succeeded",
        "simulation_rejected",
        "transaction_submitted",
      ].includes(classification);

export const processOutboxBatch = async (input: {
  batchSize: number;
  handlers: OutboxWorkerHandlers;
  leaseSeconds: number;
  phase: OutboxWorkerPhase;
  random?: () => number;
  repository: OutboxRepository;
  signal?: AbortSignal;
  workerId: string;
}): Promise<OutboxBatchResult> => {
  const signal = input.signal ?? new AbortController().signal;
  const random = input.random ?? Math.random;
  if (signal.aborted) {
    return {
      claimed: 0,
      completed: 0,
      failed: 0,
      phase: input.phase,
      stopped: true,
    };
  }

  const claims = await input.repository.claim({
    batchSize: input.batchSize,
    leaseSeconds: input.leaseSeconds,
    phase: input.phase,
    workerId: input.workerId,
  });
  let completed = 0;
  let failed = 0;

  for (const claim of claims) {
    if (signal.aborted) {
      await completeSafely(
        input.repository,
        claim,
        safeFailureOutcome(claim, random, "worker_stopped"),
      );
      failed += 1;
      continue;
    }

    const handler = input.handlers[claim.event.eventType];
    if (!handler) {
      await completeSafely(input.repository, claim, {
        classification: "configuration_blocked",
        errorCode: "handler_not_configured",
      });
      failed += 1;
      continue;
    }

    let normalizedOutcome: OutboxWorkerOutcome;
    try {
      const handlerOutcome = outboxWorkerOutcomeSchema.parse(
        await handler(claim, signal),
      );
      normalizedOutcome =
        handlerOutcome.classification === "retryable" &&
        !handlerOutcome.retryAfterSeconds
          ? {
              ...handlerOutcome,
              retryAfterSeconds: calculateRetryDelaySeconds(
                claim.attemptNumber,
                random,
              ),
            }
          : handlerOutcome;
      if (
        !outcomeMatchesPhase(input.phase, normalizedOutcome.classification)
      ) {
        normalizedOutcome = {
          classification: "non_retryable",
          errorCode: "invalid_handler_outcome",
        };
      }
    } catch {
      normalizedOutcome = safeFailureOutcome(
        claim,
        random,
        "handler_exception",
      );
    }

    await completeSafely(input.repository, claim, normalizedOutcome);
    if (
      normalizedOutcome.classification === "completed" ||
      normalizedOutcome.classification === "simulation_succeeded" ||
      normalizedOutcome.classification === "transaction_submitted"
    ) {
      completed += 1;
    } else {
      failed += 1;
    }
  }

  return {
    claimed: claims.length,
    completed,
    failed,
    phase: input.phase,
    stopped: signal.aborted,
  };
};

export const runConfiguredOutboxBatch = async (input: {
  createRepository?: () => OutboxRepository;
  handlers: OutboxWorkerHandlers;
  phase: OutboxWorkerPhase;
  signal?: AbortSignal;
  source?: Readonly<Record<string, string | undefined>>;
}): Promise<OutboxBatchResult | Readonly<{ status: "disabled" }>> => {
  const config = getOutboxWorkerConfig(input.source);
  if (!config.enabled) return { status: "disabled" };

  return processOutboxBatch({
    batchSize: config.batchSize,
    handlers: input.handlers,
    leaseSeconds: config.leaseSeconds,
    phase: input.phase,
    repository: (input.createRepository ?? createOutboxRepository)(),
    signal: input.signal,
    workerId: config.workerId,
  });
};
