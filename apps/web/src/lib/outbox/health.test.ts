import { describe, expect, it } from "vitest";

import { evaluateOperationalAlerts } from "./health";
import type { OutboxMetrics } from "./types";

const metrics = (
  overrides: Partial<OutboxMetrics> = {},
): OutboxMetrics => ({
  expiredLeases: 0,
  generatedAt: "2026-07-26T05:00:00.000Z",
  manualRetryEligible: 0,
  oldestReadyAt: null,
  receiptStateCounts: {},
  shareAccessResultCounts: {},
  shareLifecycleCounts: {},
  shareReconciliationCounts: {},
  staleReconciliationCounts: {},
  statusCounts: {},
  verifierAttemptOutcomeCounts: {},
  verifierRateLimitedFingerprints: 0,
  ...overrides,
});

describe("Milestone 6 operational alert evaluation", () => {
  it("stays quiet for a healthy metrics snapshot", () => {
    expect(evaluateOperationalAlerts(metrics())).toEqual([]);
  });

  it("raises critical alerts for dead letters and reconciliation failures", () => {
    expect(
      evaluateOperationalAlerts(
        metrics({
          receiptStateCounts: { reconciliation_failed: 2 },
          statusCounts: { dead_letter: 1 },
        }),
      ),
    ).toEqual([
      { code: "dead-letter-events", count: 1, severity: "critical" },
      { code: "reconciliation-failed", count: 2, severity: "critical" },
    ]);
  });

  it("raises bounded warnings without exposing request fingerprints", () => {
    expect(
      evaluateOperationalAlerts(
        metrics({
          expiredLeases: 1,
          manualRetryEligible: 2,
          staleReconciliationCounts: {
            anchoring_pending: 2,
            revocation_pending: 1,
          },
          verifierAttemptOutcomeCounts: { invalid: 20 },
          verifierRateLimitedFingerprints: 1,
        }),
      ),
    ).toEqual([
      { code: "expired-leases", count: 1, severity: "warning" },
      { code: "manual-retry-required", count: 2, severity: "warning" },
      {
        code: "stale-share-reconciliation",
        count: 3,
        severity: "warning",
      },
      { code: "verifier-rate-limit", count: 1, severity: "warning" },
    ]);
  });

  it("escalates ready work after three warning windows", () => {
    const now = new Date("2026-07-26T05:15:00.000Z");

    expect(
      evaluateOperationalAlerts(
        metrics({
          oldestReadyAt: "2026-07-26T05:10:00.000Z",
          statusCounts: { pending: 4 },
        }),
        { now },
      ),
    ).toContainEqual({
      code: "stale-ready-work",
      count: 4,
      severity: "warning",
    });
    expect(
      evaluateOperationalAlerts(
        metrics({
          oldestReadyAt: "2026-07-26T05:00:00.000Z",
          statusCounts: { pending: 4 },
        }),
        { now },
      ),
    ).toContainEqual({
      code: "stale-ready-work",
      count: 4,
      severity: "critical",
    });
  });
});
