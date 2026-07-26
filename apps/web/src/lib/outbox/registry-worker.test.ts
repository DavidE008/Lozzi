import { PartnerIntegrationError } from "@/lib/integrations/errors";
import { describe, expect, it, vi } from "vitest";

import type {
  AcademicRecordCommitmentResolver,
  RegistrySimulationAdapter,
} from "./registry-worker";
import { createRegistrySubmissionHandlers } from "./registry-worker";
import type { ClaimedOutboxEvent } from "./types";

const baseEvent = {
  aggregateId: "93000000-0000-4000-8000-000000000801",
  attempt: {
    attemptCount: 1,
    firstAttemptAt: "2026-07-26T03:00:00.000Z",
    lastAttemptAt: "2026-07-26T03:00:00.000Z",
    nextAttemptAt: "2026-07-26T03:00:00.000Z",
  },
  correlationId: "93000000-0000-4000-8000-000000000802",
  eventId: "93000000-0000-4000-8000-000000000803",
  idempotencyKey: "93000000-0000-4000-8000-000000000804",
  institutionId: "10000000-0000-4000-8000-000000000001",
  occurredAt: "2026-07-26T03:00:00.000Z",
  schemaVersion: 1 as const,
  traceId: "93000000-0000-4000-8000-000000000805",
};

const identityPayload = {
  commitmentEnvironment: "test" as const,
  institutionCommitment: `0x${"a1".repeat(32)}` as const,
  institutionCommitmentAlgorithm: "lozzi-institution-v1",
  institutionCommitmentKeyVersion: 1,
  studentCommitment: `0x${"b1".repeat(32)}` as const,
  studentCommitmentAlgorithm: "lozzi-student-v1",
  studentCommitmentKeyVersion: 1,
};

const claim = (
  event: ClaimedOutboxEvent["event"],
  phase: ClaimedOutboxEvent["phase"] = "submission",
): ClaimedOutboxEvent => ({
  attemptNumber: 1,
  event,
  leaseExpiresAt: "2026-07-26T03:01:00.000Z",
  phase,
  workerId: "worker.registry",
});

const adapterFixture = (): RegistrySimulationAdapter => ({
  prepare: vi.fn().mockResolvedValue(undefined),
});

const resolverFixture = (): AcademicRecordCommitmentResolver => ({
  resolve: vi.fn().mockResolvedValue(`0x${"c1".repeat(32)}`),
});

describe("registry worker submission handlers", () => {
  it("maps an anchor event to commitment-only simulation input", async () => {
    const adapter = adapterFixture();
    const handlers = createRegistrySubmissionHandlers({
      adapter,
      resolver: resolverFixture(),
    });
    const handler = handlers["academic_record.anchor.requested.v1"]!;

    await expect(
      handler(
        claim({
          ...baseEvent,
          eventType: "academic_record.anchor.requested.v1",
          payload: {
            ...identityPayload,
            academicRecordVersionId:
              "93000000-0000-4000-8000-000000000806",
            recordCommitment: `0x${"c1".repeat(32)}`,
            recordCommitmentAlgorithm: "lozzi-rfc8785-v1",
          },
        }),
        new AbortController().signal,
      ),
    ).resolves.toEqual({
      classification: "simulation_succeeded",
      receiptState: "simulation_succeeded",
    });
    expect(adapter.prepare).toHaveBeenCalledWith({
      idempotencyKey: baseEvent.idempotencyKey,
      institutionCommitment: identityPayload.institutionCommitment,
      kind: "anchor-record",
      recordVersionCommitment: `0x${"c1".repeat(32)}`,
      studentCommitment: identityPayload.studentCommitment,
    });
  });

  it("resolves a share's immutable record commitment on the server", async () => {
    const adapter = adapterFixture();
    const resolver = resolverFixture();
    const handlers = createRegistrySubmissionHandlers({ adapter, resolver });
    const handler = handlers["share_grant.create.requested.v1"]!;

    await handler(
      claim({
        ...baseEvent,
        eventType: "share_grant.create.requested.v1",
        payload: {
          ...identityPayload,
          academicRecordVersionId:
            "93000000-0000-4000-8000-000000000807",
          expiresAt: "2026-07-26T04:00:00.000Z",
          grantCommitment: `0x${"d1".repeat(32)}`,
          scopes: ["record-summary"],
          shareGrantId: "93000000-0000-4000-8000-000000000808",
        },
      }),
      new AbortController().signal,
    );

    expect(resolver.resolve).toHaveBeenCalledWith({
      academicRecordVersionId: "93000000-0000-4000-8000-000000000807",
      institutionId: baseEvent.institutionId,
    });
    expect(adapter.prepare).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "create-share",
        recordVersionCommitment: `0x${"c1".repeat(32)}`,
      }),
    );
  });

  it("maps a revocation without resolving private record data", async () => {
    const adapter = adapterFixture();
    const resolver = resolverFixture();
    const handlers = createRegistrySubmissionHandlers({ adapter, resolver });
    const handler = handlers["share_grant.revoke.requested.v1"]!;

    await handler(
      claim({
        ...baseEvent,
        eventType: "share_grant.revoke.requested.v1",
        payload: {
          ...identityPayload,
          grantCommitment: `0x${"d1".repeat(32)}`,
          revokedAt: "2026-07-26T03:00:00.000Z",
          shareGrantId: "93000000-0000-4000-8000-000000000809",
        },
      }),
      new AbortController().signal,
    );

    expect(resolver.resolve).not.toHaveBeenCalled();
    expect(adapter.prepare).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "revoke-share" }),
    );
  });

  it.each([
    [
      new PartnerIntegrationError("configuration", "not configured"),
      {
        classification: "configuration_blocked",
        errorCode: "registry_not_configured",
      },
    ],
    [
      new PartnerIntegrationError("invalid-response", "simulation reverted"),
      {
        classification: "simulation_rejected",
        errorCode: "registry_simulation_rejected",
        receiptState: "simulation_rejected",
      },
    ],
    [
      new PartnerIntegrationError("integrity", "wrong chain"),
      {
        classification: "non_retryable",
        errorCode: "registry_integrity_check_failed",
      },
    ],
    [
      new TypeError("rpc unavailable with secret payload"),
      {
        classification: "retryable",
        errorCode: "registry_temporarily_unavailable",
      },
    ],
  ] as const)("persists only a safe failure code for %s", async (error, expected) => {
    const adapter: RegistrySimulationAdapter = {
      prepare: vi.fn().mockRejectedValue(error),
    };
    const handlers = createRegistrySubmissionHandlers({
      adapter,
      resolver: resolverFixture(),
    });

    const outcome = await handlers["academic_record.anchor.requested.v1"]!(
      claim({
        ...baseEvent,
        eventType: "academic_record.anchor.requested.v1",
        payload: {
          ...identityPayload,
          academicRecordVersionId:
            "93000000-0000-4000-8000-000000000810",
          recordCommitment: `0x${"c1".repeat(32)}`,
          recordCommitmentAlgorithm: "lozzi-rfc8785-v1",
        },
      }),
      new AbortController().signal,
    );

    expect(outcome).toEqual(expected);
    expect(JSON.stringify(outcome)).not.toContain("secret payload");
  });

  it("rejects accidental reconciliation use without calling the adapter", async () => {
    const adapter = adapterFixture();
    const handlers = createRegistrySubmissionHandlers({
      adapter,
      resolver: resolverFixture(),
    });

    await expect(
      handlers["academic_record.anchor.requested.v1"]!(
        claim(
          {
            ...baseEvent,
            eventType: "academic_record.anchor.requested.v1",
            payload: {
              ...identityPayload,
              academicRecordVersionId:
                "93000000-0000-4000-8000-000000000811",
              recordCommitment: `0x${"c1".repeat(32)}`,
              recordCommitmentAlgorithm: "lozzi-rfc8785-v1",
            },
          },
          "reconciliation",
        ),
        new AbortController().signal,
      ),
    ).resolves.toEqual({
      classification: "non_retryable",
      errorCode: "invalid_worker_phase",
    });
    expect(adapter.prepare).not.toHaveBeenCalled();
  });

  it("converts absent default configuration into operator-visible state", async () => {
    const handlers = createRegistrySubmissionHandlers();

    await expect(
      handlers["academic_record.anchor.requested.v1"]!(
        claim({
          ...baseEvent,
          eventType: "academic_record.anchor.requested.v1",
          payload: {
            ...identityPayload,
            academicRecordVersionId:
              "93000000-0000-4000-8000-000000000812",
            recordCommitment: `0x${"c1".repeat(32)}`,
            recordCommitmentAlgorithm: "lozzi-rfc8785-v1",
          },
        }),
        new AbortController().signal,
      ),
    ).resolves.toEqual({
      classification: "configuration_blocked",
      errorCode: "registry_not_configured",
    });
  });
});
