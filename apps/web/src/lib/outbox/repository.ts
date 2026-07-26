import "server-only";

import { outboxEventSchema } from "@lozzi/domain";
import { z } from "zod";

import { createServiceClient } from "@/lib/supabase/service";

import {
  outboxWorkerOutcomeSchema,
  type ClaimedOutboxEvent,
  type OutboxCompletion,
  type OutboxMetrics,
  type OutboxRepository,
  type OutboxWorkerOutcome,
  type OutboxWorkerPhase,
} from "./types";

type RpcResult = PromiseLike<{
  data: unknown;
  error: { code?: string; message?: string } | null;
}>;

type OutboxRpcClient = {
  rpc: (name: string, parameters?: Record<string, unknown>) => RpcResult;
};

const claimRowSchema = z
  .object({
    aggregate_id: z.uuid(),
    aggregate_type: z.string().min(1),
    attempt_number: z.number().int().positive(),
    available_at: z.iso.datetime(),
    correlation_id: z.uuid(),
    created_at: z.iso.datetime(),
    event_id: z.uuid(),
    event_type: z.string().min(1),
    first_attempt_at: z.iso.datetime(),
    idempotency_key: z.uuid(),
    institution_id: z.uuid(),
    last_attempt_at: z.iso.datetime(),
    lease_expires_at: z.iso.datetime(),
    payload: z.unknown(),
    schema_version: z.literal(1),
    trace_id: z.uuid(),
  })
  .strict();

const completionSchema = z
  .object({
    attemptNumber: z.number().int().positive(),
    availableAt: z.iso.datetime(),
    eventId: z.uuid(),
    idempotentReplay: z.boolean().optional().default(false),
    manualRetryEligible: z.boolean(),
    status: z.string().min(1),
  })
  .strict();

const metricsSchema = z
  .object({
    expiredLeases: z.number().int().min(0),
    generatedAt: z.iso.datetime(),
    manualRetryEligible: z.number().int().min(0),
    oldestReadyAt: z.iso.datetime().nullable(),
    receiptStateCounts: z.record(z.string(), z.number().int().min(0)),
    statusCounts: z.record(z.string(), z.number().int().min(0)),
  })
  .strict();

const rpcError = (operation: string, code?: string) =>
  new Error(`Outbox ${operation} failed${code ? ` (${code})` : ""}.`);

const toClaim = (
  rowInput: unknown,
  phase: OutboxWorkerPhase,
  workerId: string,
): ClaimedOutboxEvent => {
  const row = claimRowSchema.parse(rowInput);
  const event = outboxEventSchema.parse({
    aggregateId: row.aggregate_id,
    attempt: {
      attemptCount: row.attempt_number,
      firstAttemptAt: row.first_attempt_at,
      lastAttemptAt: row.last_attempt_at,
      nextAttemptAt: row.available_at,
    },
    correlationId: row.correlation_id,
    eventId: row.event_id,
    eventType: row.event_type,
    idempotencyKey: row.idempotency_key,
    institutionId: row.institution_id,
    occurredAt: row.created_at,
    payload: row.payload,
    schemaVersion: row.schema_version,
    traceId: row.trace_id,
  });

  return {
    attemptNumber: row.attempt_number,
    event,
    leaseExpiresAt: row.lease_expires_at,
    phase,
    workerId,
  };
};

const transactionHashToDatabase = (value: string | undefined) =>
  value ? `\\x${value.slice(2)}` : null;

export class SupabaseOutboxRepository implements OutboxRepository {
  constructor(private readonly client: OutboxRpcClient) {}

  async claim(input: {
    batchSize: number;
    leaseSeconds: number;
    phase: OutboxWorkerPhase;
    workerId: string;
  }): Promise<ClaimedOutboxEvent[]> {
    const { data, error } = await this.client.rpc("claim_m6_outbox_events", {
      p_batch_size: input.batchSize,
      p_lease_seconds: input.leaseSeconds,
      p_phase: input.phase,
      p_worker_id: input.workerId,
    });
    if (error) throw rpcError("claim", error.code);

    return z
      .array(z.unknown())
      .parse(data)
      .map((row) => toClaim(row, input.phase, input.workerId));
  }

  async complete(
    claim: ClaimedOutboxEvent,
    outcomeInput: OutboxWorkerOutcome,
  ): Promise<OutboxCompletion> {
    const outcome = outboxWorkerOutcomeSchema.parse(outcomeInput);
    const { data, error } = await this.client.rpc("complete_m6_outbox_event", {
      p_attempt_number: claim.attemptNumber,
      p_chain_id: outcome.chainId ?? null,
      p_confirmation_count: outcome.confirmationCount ?? null,
      p_error_code: outcome.errorCode ?? null,
      p_event_id: claim.event.eventId,
      p_expected_confirmations: outcome.expectedConfirmations ?? null,
      p_outcome: outcome.classification,
      p_provider_operation_id: outcome.providerOperationId ?? null,
      p_receipt_state: outcome.receiptState ?? null,
      p_retry_after_seconds: outcome.retryAfterSeconds ?? null,
      p_transaction_hash: transactionHashToDatabase(outcome.transactionHash),
      p_worker_id: claim.workerId,
    });
    if (error) throw rpcError("completion", error.code);
    return completionSchema.parse(data);
  }

  async metrics(): Promise<OutboxMetrics> {
    const { data, error } = await this.client.rpc("get_m6_outbox_metrics");
    if (error) throw rpcError("metrics read", error.code);
    return metricsSchema.parse(data);
  }

  async renew(
    claim: ClaimedOutboxEvent,
    leaseSeconds: number,
  ): Promise<string> {
    const { data, error } = await this.client.rpc("renew_m6_outbox_lease", {
      p_attempt_number: claim.attemptNumber,
      p_event_id: claim.event.eventId,
      p_lease_seconds: leaseSeconds,
      p_worker_id: claim.workerId,
    });
    if (error) throw rpcError("lease renewal", error.code);
    return z.iso.datetime().parse(data);
  }

}

export const createOutboxRepository = (
  client: OutboxRpcClient = createServiceClient() as unknown as OutboxRpcClient,
): OutboxRepository => new SupabaseOutboxRepository(client);
