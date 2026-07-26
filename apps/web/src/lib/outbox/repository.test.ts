import { describe, expect, it, vi } from "vitest";

import { SupabaseOutboxRepository } from "./repository";

const claimRow = {
  aggregate_id: "93000000-0000-4000-8000-000000000402",
  aggregate_type: "record_share_grant",
  attempt_number: 2,
  available_at: "2026-07-26T01:00:00.000Z",
  correlation_id: "93000000-0000-4000-8000-000000000403",
  created_at: "2026-07-26T00:59:00.000Z",
  event_id: "93000000-0000-4000-8000-000000000401",
  event_type: "share_grant.revoke.requested.v1",
  first_attempt_at: "2026-07-26T00:59:30.000Z",
  idempotency_key: "93000000-0000-4000-8000-000000000404",
  institution_id: "10000000-0000-4000-8000-000000000001",
  last_attempt_at: "2026-07-26T01:00:00.000Z",
  lease_expires_at: "2026-07-26T01:01:00.000Z",
  payload: {
    commitmentEnvironment: "test",
    grantCommitment: `0x${"d1".repeat(32)}`,
    institutionCommitment: `0x${"a1".repeat(32)}`,
    institutionCommitmentAlgorithm: "lozzi-institution-v1",
    institutionCommitmentKeyVersion: 1,
    revokedAt: "2026-07-26T00:58:00.000Z",
    shareGrantId: "93000000-0000-4000-8000-000000000402",
    studentCommitment: `0x${"b1".repeat(32)}`,
    studentCommitmentAlgorithm: "lozzi-student-v1",
    studentCommitmentKeyVersion: 1,
  },
  schema_version: 1,
  trace_id: "93000000-0000-4000-8000-000000000405",
};

describe("Supabase outbox repository", () => {
  it("maps a claimed database row through the versioned domain schema", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [claimRow],
      error: null,
    });
    const repository = new SupabaseOutboxRepository({ rpc });

    const claims = await repository.claim({
      batchSize: 5,
      leaseSeconds: 60,
      phase: "submission",
      workerId: "worker.test",
    });

    expect(rpc).toHaveBeenCalledWith("claim_m6_outbox_events", {
      p_batch_size: 5,
      p_lease_seconds: 60,
      p_phase: "submission",
      p_worker_id: "worker.test",
    });
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({
      attemptNumber: 2,
      phase: "submission",
      workerId: "worker.test",
      event: {
        eventId: claimRow.event_id,
        eventType: claimRow.event_type,
      },
    });
  });

  it("rejects malformed or unknown event versions returned by the database", async () => {
    const repository = new SupabaseOutboxRepository({
      rpc: vi.fn().mockResolvedValue({
        data: [{ ...claimRow, event_type: "unknown.requested.v2" }],
        error: null,
      }),
    });

    await expect(
      repository.claim({
        batchSize: 1,
        leaseSeconds: 60,
        phase: "submission",
        workerId: "worker.test",
      }),
    ).rejects.toThrow();
  });

  it("passes only explicit receipt fields to completion", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [claimRow], error: null })
      .mockResolvedValueOnce({
        data: {
          attemptNumber: 2,
          availableAt: "2026-07-26T01:00:00.000Z",
          eventId: claimRow.event_id,
          manualRetryEligible: false,
          status: "transaction_submitted",
        },
        error: null,
      });
    const repository = new SupabaseOutboxRepository({ rpc });
    const [claim] = await repository.claim({
      batchSize: 1,
      leaseSeconds: 60,
      phase: "submission",
      workerId: "worker.test",
    });

    await repository.complete(claim!, {
      chainId: 4801,
      classification: "transaction_submitted",
      expectedConfirmations: 3,
      providerOperationId: "relayer:request:1",
      receiptState: "transaction_submitted",
      transactionHash: `0x${"ef".repeat(32)}`,
    });

    expect(rpc).toHaveBeenLastCalledWith(
      "complete_m6_outbox_event",
      expect.objectContaining({
        p_chain_id: 4801,
        p_event_id: claimRow.event_id,
        p_provider_operation_id: "relayer:request:1",
        p_transaction_hash: `\\x${"ef".repeat(32)}`,
        p_worker_id: "worker.test",
      }),
    );
  });

  it("returns structured metrics and does not expose RPC error messages", async () => {
    const repository = new SupabaseOutboxRepository({
      rpc: vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            expiredLeases: 1,
            generatedAt: "2026-07-26T01:00:00.000Z",
            manualRetryEligible: 2,
            oldestReadyAt: null,
            receiptStateCounts: { confirmation_pending: 1 },
            statusCounts: { pending: 3 },
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: {
            code: "XX000",
            message: "bearer token and raw RPC body",
          },
        }),
    });

    await expect(repository.metrics()).resolves.toMatchObject({
      expiredLeases: 1,
      statusCounts: { pending: 3 },
    });
    const failure = repository.metrics();
    await expect(failure).rejects.toThrow(
      "Outbox metrics read failed (XX000).",
    );
    await expect(failure).rejects.not.toThrow("bearer token");
  });
});
