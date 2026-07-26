import type { OutboxEvent, OutboxEventType } from "@lozzi/domain";
import { z } from "zod";

export const outboxWorkerPhaseSchema = z.enum([
  "submission",
  "reconciliation",
]);

export const outboxWorkerOutcomeSchema = z
  .object({
    classification: z.enum([
      "completed",
      "retryable",
      "non_retryable",
      "configuration_blocked",
      "simulation_succeeded",
      "simulation_rejected",
      "transaction_submitted",
      "confirmation_pending",
      "reconciliation_failed",
    ]),
    confirmationCount: z.number().int().min(0).optional(),
    errorCode: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9][a-z0-9._:-]*$/u)
      .optional(),
    expectedConfirmations: z.number().int().min(1).max(256).optional(),
    chainId: z.number().int().positive().optional(),
    providerOperationId: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[A-Za-z0-9._:-]+$/u)
      .optional(),
    receiptState: z
      .enum([
        "simulation_succeeded",
        "simulation_rejected",
        "transaction_submitted",
        "confirmation_pending",
        "confirmed",
        "reconciled",
        "reconciliation_failed",
      ])
      .optional(),
    retryAfterSeconds: z.number().int().min(1).max(3_600).optional(),
    transactionHash: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/u)
      .optional(),
  })
  .strict()
  .superRefine((outcome, context) => {
    if (
      outcome.classification === "transaction_submitted" &&
      !outcome.providerOperationId
    ) {
      context.addIssue({
        code: "custom",
        message: "A submitted transaction requires a provider operation ID",
        path: ["providerOperationId"],
      });
    }
  });

export type OutboxWorkerPhase = z.infer<typeof outboxWorkerPhaseSchema>;
export type OutboxWorkerOutcome = z.infer<typeof outboxWorkerOutcomeSchema>;

export type ClaimedOutboxEvent = Readonly<{
  attemptNumber: number;
  event: OutboxEvent;
  leaseExpiresAt: string;
  phase: OutboxWorkerPhase;
  workerId: string;
}>;

export type OutboxWorkerHandler = (
  claim: ClaimedOutboxEvent,
  signal: AbortSignal,
) => Promise<OutboxWorkerOutcome>;

export type OutboxWorkerHandlers = Readonly<
  Partial<Record<OutboxEventType, OutboxWorkerHandler>>
>;

export type OutboxCompletion = Readonly<{
  attemptNumber: number;
  availableAt: string;
  eventId: string;
  idempotentReplay: boolean;
  manualRetryEligible: boolean;
  status: string;
}>;

export type OutboxMetrics = Readonly<{
  expiredLeases: number;
  generatedAt: string;
  manualRetryEligible: number;
  oldestReadyAt: string | null;
  receiptStateCounts: Readonly<Record<string, number>>;
  statusCounts: Readonly<Record<string, number>>;
}>;

export interface OutboxRepository {
  claim(input: {
    batchSize: number;
    leaseSeconds: number;
    phase: OutboxWorkerPhase;
    workerId: string;
  }): Promise<ClaimedOutboxEvent[]>;
  complete(
    claim: ClaimedOutboxEvent,
    outcome: OutboxWorkerOutcome,
  ): Promise<OutboxCompletion>;
  metrics(): Promise<OutboxMetrics>;
  renew(
    claim: ClaimedOutboxEvent,
    leaseSeconds: number,
  ): Promise<string>;
}
