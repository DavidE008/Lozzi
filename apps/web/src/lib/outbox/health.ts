import type { OutboxMetrics } from "./types";

export type OperationalAlert = Readonly<{
  code:
    | "dead-letter-events"
    | "expired-leases"
    | "manual-retry-required"
    | "reconciliation-failed"
    | "stale-ready-work"
    | "stale-share-reconciliation"
    | "verifier-rate-limit";
  count: number;
  severity: "critical" | "warning";
}>;

const total = (counts: Readonly<Record<string, number>>): number =>
  Object.values(counts).reduce((sum, value) => sum + value, 0);

export const evaluateOperationalAlerts = (
  metrics: OutboxMetrics,
  options: {
    readonly now?: Date;
    readonly readyWarningSeconds?: number;
  } = {},
): OperationalAlert[] => {
  const alerts: OperationalAlert[] = [];
  const readyWarningSeconds = options.readyWarningSeconds ?? 300;
  const now = options.now ?? new Date();
  const deadLetters = metrics.statusCounts.dead_letter ?? 0;
  const reconciliationFailures =
    metrics.receiptStateCounts.reconciliation_failed ?? 0;
  const staleReconciliations = total(metrics.staleReconciliationCounts);

  if (deadLetters > 0) {
    alerts.push({
      code: "dead-letter-events",
      count: deadLetters,
      severity: "critical",
    });
  }
  if (reconciliationFailures > 0) {
    alerts.push({
      code: "reconciliation-failed",
      count: reconciliationFailures,
      severity: "critical",
    });
  }
  if (metrics.expiredLeases > 0) {
    alerts.push({
      code: "expired-leases",
      count: metrics.expiredLeases,
      severity: "warning",
    });
  }
  if (metrics.manualRetryEligible > 0) {
    alerts.push({
      code: "manual-retry-required",
      count: metrics.manualRetryEligible,
      severity: "warning",
    });
  }
  if (staleReconciliations > 0) {
    alerts.push({
      code: "stale-share-reconciliation",
      count: staleReconciliations,
      severity: "warning",
    });
  }
  if (metrics.verifierRateLimitedFingerprints > 0) {
    alerts.push({
      code: "verifier-rate-limit",
      count: metrics.verifierRateLimitedFingerprints,
      severity: "warning",
    });
  }
  if (metrics.oldestReadyAt) {
    const ageSeconds =
      (now.getTime() - new Date(metrics.oldestReadyAt).getTime()) / 1_000;
    if (ageSeconds >= readyWarningSeconds) {
      alerts.push({
        code: "stale-ready-work",
        count: Math.max(1, metrics.statusCounts.pending ?? 0),
        severity:
          ageSeconds >= readyWarningSeconds * 3 ? "critical" : "warning",
      });
    }
  }

  return alerts;
};
