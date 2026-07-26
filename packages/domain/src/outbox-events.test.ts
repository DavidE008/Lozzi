import { describe, expect, it } from "vitest";

import {
  academicRecordAnchorRequestedV1Schema,
  outboxEventSchema,
  shareGrantCreateRequestedV1Schema,
} from "./outbox-events";

const baseEvent = {
  aggregateId: "10000000-0000-4000-8000-000000000101",
  attempt: {
    attemptCount: 0,
    firstAttemptAt: null,
    lastAttemptAt: null,
    nextAttemptAt: null,
  },
  correlationId: "10000000-0000-4000-8000-000000000102",
  eventId: "10000000-0000-4000-8000-000000000103",
  idempotencyKey: "record-anchor:10000000-0000-4000-8000-000000000101",
  institutionId: "10000000-0000-4000-8000-000000000001",
  occurredAt: "2026-07-26T01:30:00.000Z",
  schemaVersion: 1 as const,
  traceId: "10000000-0000-4000-8000-000000000104",
};

const commitmentIdentity = {
  institutionCommitment: `0x${"11".repeat(32)}`,
  institutionCommitmentAlgorithm: "lozzi-institution-v1",
  institutionCommitmentKeyVersion: 1,
  studentCommitment: `0x${"22".repeat(32)}`,
  studentCommitmentAlgorithm: "lozzi-student-v1",
  studentCommitmentKeyVersion: 1,
};

const anchorEvent = {
  ...baseEvent,
  eventType: "academic_record.anchor.requested.v1" as const,
  payload: {
    ...commitmentIdentity,
    academicRecordVersionId: baseEvent.aggregateId,
    recordCommitment: `0x${"33".repeat(32)}`,
    recordCommitmentAlgorithm: "lozzi-rfc8785-v1",
  },
};

describe("Milestone 6 outbox event schemas", () => {
  it("accepts the versioned academic record anchor envelope", () => {
    expect(academicRecordAnchorRequestedV1Schema.parse(anchorEvent)).toEqual(
      anchorEvent,
    );
  });

  it("rejects unknown schema versions and event names", () => {
    expect(
      outboxEventSchema.safeParse({ ...anchorEvent, schemaVersion: 2 }).success,
    ).toBe(false);
    expect(
      outboxEventSchema.safeParse({
        ...anchorEvent,
        eventType: "academic_record.anchor.requested.v2",
      }).success,
    ).toBe(false);
  });

  it("rejects malformed commitments and unrecognized payload fields", () => {
    expect(
      outboxEventSchema.safeParse({
        ...anchorEvent,
        payload: {
          ...anchorEvent.payload,
          recordCommitment: "0x1234",
        },
      }).success,
    ).toBe(false);
    expect(
      outboxEventSchema.safeParse({
        ...anchorEvent,
        payload: {
          ...anchorEvent.payload,
          courseName: "Private course data must not enter the outbox",
        },
      }).success,
    ).toBe(false);
  });

  it("requires selected, unique, recognized share scopes", () => {
    const shareEvent = {
      ...baseEvent,
      aggregateId: "10000000-0000-4000-8000-000000000201",
      eventType: "share_grant.create.requested.v1" as const,
      idempotencyKey: "share-create:10000000-0000-4000-8000-000000000201",
      payload: {
        ...commitmentIdentity,
        academicRecordVersionId: baseEvent.aggregateId,
        expiresAt: "2026-07-26T02:00:00.000Z",
        grantCommitment: `0x${"44".repeat(32)}`,
        scopes: ["record-summary"],
        shareGrantId: "10000000-0000-4000-8000-000000000201",
      },
    };

    expect(shareGrantCreateRequestedV1Schema.parse(shareEvent)).toEqual(
      shareEvent,
    );
    expect(
      shareGrantCreateRequestedV1Schema.safeParse({
        ...shareEvent,
        payload: { ...shareEvent.payload, scopes: [] },
      }).success,
    ).toBe(false);
    expect(
      shareGrantCreateRequestedV1Schema.safeParse({
        ...shareEvent,
        payload: {
          ...shareEvent.payload,
          scopes: ["record-summary", "record-summary"],
        },
      }).success,
    ).toBe(false);
    expect(
      shareGrantCreateRequestedV1Schema.safeParse({
        ...shareEvent,
        payload: { ...shareEvent.payload, scopes: ["everything"] },
      }).success,
    ).toBe(false);
  });
});
