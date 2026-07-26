import { describe, expect, it, vi } from "vitest";

import {
  calculateRetryDelaySeconds,
  getOutboxWorkerConfig,
  processOutboxBatch,
  runConfiguredOutboxBatch,
} from "./processor";
import type {
  ClaimedOutboxEvent,
  OutboxRepository,
  OutboxWorkerOutcome,
} from "./types";

const claimFixture = (
  eventId = "93000000-0000-4000-8000-000000000301",
): ClaimedOutboxEvent => ({
  attemptNumber: 1,
  event: {
    aggregateId: "93000000-0000-4000-8000-000000000302",
    attempt: {
      attemptCount: 1,
      firstAttemptAt: "2026-07-26T01:00:00.000Z",
      lastAttemptAt: "2026-07-26T01:00:00.000Z",
      nextAttemptAt: "2026-07-26T01:00:00.000Z",
    },
    correlationId: "93000000-0000-4000-8000-000000000303",
    eventId,
    eventType: "share_grant.revoke.requested.v1",
    idempotencyKey: "93000000-0000-4000-8000-000000000304",
    institutionId: "10000000-0000-4000-8000-000000000001",
    occurredAt: "2026-07-26T01:00:00.000Z",
    payload: {
      commitmentEnvironment: "test",
      grantCommitment: `0x${"d1".repeat(32)}`,
      institutionCommitment: `0x${"a1".repeat(32)}`,
      institutionCommitmentAlgorithm: "lozzi-institution-v1",
      institutionCommitmentKeyVersion: 1,
      revokedAt: "2026-07-26T01:00:00.000Z",
      shareGrantId: "93000000-0000-4000-8000-000000000302",
      studentCommitment: `0x${"b1".repeat(32)}`,
      studentCommitmentAlgorithm: "lozzi-student-v1",
      studentCommitmentKeyVersion: 1,
    },
    schemaVersion: 1,
    traceId: "93000000-0000-4000-8000-000000000305",
  },
  leaseExpiresAt: "2026-07-26T01:01:00.000Z",
  phase: "submission",
  workerId: "worker.test",
});

const repositoryFixture = (
  claims: ClaimedOutboxEvent[],
  completions: OutboxWorkerOutcome[],
): OutboxRepository => ({
  claim: vi.fn().mockResolvedValue(claims),
  complete: vi.fn(async (_claim, outcome) => {
    completions.push(outcome);
    return {
      attemptNumber: 1,
      availableAt: "2026-07-26T01:00:00.000Z",
      eventId: claims[0]?.event.eventId ?? crypto.randomUUID(),
      idempotentReplay: false,
      manualRetryEligible: false,
      status: outcome.classification,
    };
  }),
  metrics: vi.fn(),
  renew: vi.fn(),
});

describe("Milestone 6 outbox worker", () => {
  it("remains disabled unless explicitly enabled", async () => {
    const createRepository = vi.fn();

    await expect(
      runConfiguredOutboxBatch({
        createRepository,
        handlers: {},
        phase: "submission",
        source: {},
      }),
    ).resolves.toEqual({ status: "disabled" });
    expect(createRepository).not.toHaveBeenCalled();
  });

  it("validates bounded enabled configuration", () => {
    expect(
      getOutboxWorkerConfig({
        M6_OUTBOX_WORKER_BATCH_SIZE: "50",
        M6_OUTBOX_WORKER_ENABLED: "1",
        M6_OUTBOX_WORKER_ID: "worker.production:1",
        M6_OUTBOX_WORKER_LEASE_SECONDS: "300",
      }),
    ).toEqual({
      batchSize: 50,
      enabled: true,
      leaseSeconds: 300,
      workerId: "worker.production:1",
    });
    expect(() =>
      getOutboxWorkerConfig({
        M6_OUTBOX_WORKER_BATCH_SIZE: "51",
        M6_OUTBOX_WORKER_ENABLED: "1",
        M6_OUTBOX_WORKER_ID: "worker.production:1",
      }),
    ).toThrow();
  });

  it("keeps exponential retry delay bounded with jitter", () => {
    expect(calculateRetryDelaySeconds(1, () => 0)).toBe(4);
    expect(calculateRetryDelaySeconds(1, () => 1)).toBe(6);
    expect(calculateRetryDelaySeconds(4, () => 0.5)).toBe(40);
    expect(calculateRetryDelaySeconds(100, () => 1)).toBe(900);
  });

  it("processes one bounded batch through the configured handler", async () => {
    const completions: OutboxWorkerOutcome[] = [];
    const claim = claimFixture();
    const repository = repositoryFixture([claim], completions);
    const handler = vi
      .fn()
      .mockResolvedValue({ classification: "simulation_succeeded" });

    await expect(
      processOutboxBatch({
        batchSize: 10,
        handlers: {
          "share_grant.revoke.requested.v1": handler,
        },
        leaseSeconds: 60,
        phase: "submission",
        repository,
        workerId: "worker.test",
      }),
    ).resolves.toEqual({
      claimed: 1,
      completed: 1,
      failed: 0,
      phase: "submission",
      stopped: false,
    });
    expect(repository.claim).toHaveBeenCalledWith({
      batchSize: 10,
      leaseSeconds: 60,
      phase: "submission",
      workerId: "worker.test",
    });
    expect(handler).toHaveBeenCalledWith(claim, expect.any(AbortSignal));
    expect(completions).toEqual([
      { classification: "simulation_succeeded" },
    ]);
  });

  it("classifies a missing handler without attempting partner work", async () => {
    const completions: OutboxWorkerOutcome[] = [];

    await processOutboxBatch({
      batchSize: 1,
      handlers: {},
      leaseSeconds: 60,
      phase: "submission",
      repository: repositoryFixture([claimFixture()], completions),
      workerId: "worker.test",
    });

    expect(completions).toEqual([
      {
        classification: "configuration_blocked",
        errorCode: "handler_not_configured",
      },
    ]);
  });

  it("rejects handler outcomes that overstate the active phase", async () => {
    const completions: OutboxWorkerOutcome[] = [];

    await processOutboxBatch({
      batchSize: 1,
      handlers: {
        "share_grant.revoke.requested.v1": async () => ({
          classification: "completed",
        }),
      },
      leaseSeconds: 60,
      phase: "submission",
      repository: repositoryFixture([claimFixture()], completions),
      workerId: "worker.test",
    });

    expect(completions).toEqual([
      {
        classification: "non_retryable",
        errorCode: "invalid_handler_outcome",
      },
    ]);
  });

  it("converts handler exceptions to a safe retry classification", async () => {
    const completions: OutboxWorkerOutcome[] = [];
    const sensitiveFailure = new Error(
      "rpc=https://secret.example token=bearer-secret",
    );

    await processOutboxBatch({
      batchSize: 1,
      handlers: {
        "share_grant.revoke.requested.v1": async () => {
          throw sensitiveFailure;
        },
      },
      leaseSeconds: 60,
      phase: "submission",
      random: () => 0.5,
      repository: repositoryFixture([claimFixture()], completions),
      workerId: "worker.test",
    });

    expect(completions).toEqual([
      {
        classification: "retryable",
        errorCode: "handler_exception",
        retryAfterSeconds: 5,
      },
    ]);
    expect(JSON.stringify(completions)).not.toContain("bearer-secret");
  });

  it("stops before claiming when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const repository = repositoryFixture([], []);

    await expect(
      processOutboxBatch({
        batchSize: 10,
        handlers: {},
        leaseSeconds: 60,
        phase: "submission",
        repository,
        signal: controller.signal,
        workerId: "worker.test",
      }),
    ).resolves.toMatchObject({ claimed: 0, stopped: true });
    expect(repository.claim).not.toHaveBeenCalled();
  });

  it("releases remaining claims with a bounded retry on clean abort", async () => {
    const controller = new AbortController();
    const completions: OutboxWorkerOutcome[] = [];
    const claims = [
      claimFixture("93000000-0000-4000-8000-000000000311"),
      claimFixture("93000000-0000-4000-8000-000000000312"),
    ];

    const result = await processOutboxBatch({
      batchSize: 2,
      handlers: {
        "share_grant.revoke.requested.v1": async () => {
          controller.abort();
          return { classification: "simulation_succeeded" };
        },
      },
      leaseSeconds: 60,
      phase: "submission",
      random: () => 0.5,
      repository: repositoryFixture(claims, completions),
      signal: controller.signal,
      workerId: "worker.test",
    });

    expect(result).toMatchObject({ claimed: 2, stopped: true });
    expect(completions).toEqual([
      { classification: "simulation_succeeded" },
      {
        classification: "retryable",
        errorCode: "worker_stopped",
        retryAfterSeconds: 5,
      },
    ]);
  });
});
