import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  summarizeSubmissionStatus,
  validateReviewBinding,
  validateSubmissionStatus,
} from "./m7-submission-status.mjs";

const root = path.resolve(import.meta.dirname, "../../..");
const status = JSON.parse(
  await readFile(
    path.resolve(root, "deployment/milestone-7/submission-status.json"),
    "utf8",
  ),
);

const clone = (value) => structuredClone(value);
const gate = (candidate, id) =>
  candidate.requiredGates.find((entry) => entry.id === id);
const markPassed = (candidate, id) => {
  gate(candidate, id).status = "passed";
  gate(candidate, id).blockers = [];
};

test("accepts the honest tracked status and reports every live gate blocked", () => {
  assert.deepEqual(validateSubmissionStatus(status), []);

  const summary = summarizeSubmissionStatus(status);
  assert.equal(summary.readyForSubmission, false);
  assert.equal(summary.readyForDeployment, false);
  assert.equal(summary.passedGateCount, 2);
  assert.equal(summary.blockedGateCount, 8);
  assert.deepEqual(
    summary.blockedGates.map((gate) => gate.id),
    [
      "dependency-security",
      "hosted-supabase",
      "frontend-deployment",
      "world-runtime",
      "world-submission-metadata",
      "ens-live-integration",
      "registry-deployment",
      "event-submission-target",
    ],
  );
});

test("rejects secret or signed material in keys, values, and unknown fields", () => {
  const candidate = clone(status);
  candidate.world.privateKey = "forbidden";
  candidate.registries.rawTransaction = "0xdeadbeef";
  candidate.requiredGates[0].evidence.push(`private key: 0x${"11".repeat(32)}`);
  candidate.world.apiKey = "sk-forbidden-material-1234567890";

  const errors = validateSubmissionStatus(candidate);
  assert.ok(errors.some((error) => error.includes("$.world.privateKey")));
  assert.ok(
    errors.some((error) => error.includes("$.registries.rawTransaction")),
  );
  assert.ok(
    errors.some((error) => error.includes("$.requiredGates[0].evidence[4]")),
  );
  assert.ok(errors.some((error) => error.includes("$.world.apiKey")));
});

const missingEvidenceMutations = new Map([
  [
    "public-repository",
    (candidate) => {
      candidate.repository.mainQualityStatus = "failed";
    },
  ],
  [
    "local-verification",
    (candidate) => {
      candidate.verification.domainTests = 54;
    },
  ],
  ["dependency-security", () => {}],
  ["hosted-supabase", () => {}],
  ["frontend-deployment", () => {}],
  ["world-runtime", () => {}],
  ["world-submission-metadata", () => {}],
  ["ens-live-integration", () => {}],
  ["registry-deployment", () => {}],
  ["event-submission-target", () => {}],
]);

for (const [id, mutate] of missingEvidenceMutations) {
  test(`rejects ${id} when its typed readiness evidence is absent`, () => {
    const candidate = clone(status);
    markPassed(candidate, id);
    mutate(candidate);

    const errors = validateSubmissionStatus(candidate);
    assert.ok(
      errors.some((error) => error.includes(`$.requiredGates.${id}`)),
      errors.join("\n"),
    );
  });
}

test("never reports deployment ready from registry fields alone", () => {
  const candidate = clone(status);
  candidate.registries = {
    ...candidate.registries,
    status: "deployed",
    approvedChainId: 4801,
    institutionRegistryAddress: `0x${"11".repeat(20)}`,
    academicRecordRegistryAddress: `0x${"22".repeat(20)}`,
    unsignedSimulationStatus: "passed",
    independentReviewStatus: "approved",
  };

  assert.equal(summarizeSubmissionStatus(candidate).readyForDeployment, false);

  markPassed(candidate, "registry-deployment");
  assert.equal(summarizeSubmissionStatus(candidate).readyForDeployment, false);
});

test("requires internally consistent static-analysis findings", () => {
  const candidate = clone(status);
  candidate.verification.slitherFindingCount = 17;
  candidate.verification.slitherStatus = "passed";

  const errors = validateSubmissionStatus(candidate);
  assert.ok(
    errors.some((error) =>
      error.includes("$.verification.slitherFindingCount"),
    ),
  );
  assert.ok(
    errors.some((error) => error.includes("$.verification.slitherStatus")),
  );
});

test("binds readiness to fresh reviewed evidence and a clean worktree", () => {
  const now = Date.parse("2026-07-26T12:00:00.000Z");
  const valid = {
    changedPaths: ["deployment/milestone-7/submission-status.json"],
    now,
    reviewedAt: "2026-07-26T11:00:00.000Z",
    statusPath: "deployment/milestone-7/submission-status.json",
    worktreeStatus: "",
  };
  assert.deepEqual(validateReviewBinding(valid), []);

  assert.ok(
    validateReviewBinding({
      ...valid,
      changedPaths: ["apps/web/src/unreviewed.ts"],
    }).some((error) => error.includes("unreviewed paths")),
  );
  assert.ok(
    validateReviewBinding({
      ...valid,
      worktreeStatus: "?? local-untracked.txt",
    }).some((error) => error.includes("working tree")),
  );
  assert.ok(
    validateReviewBinding({
      ...valid,
      reviewedAt: "2026-07-25T10:59:59.000Z",
    }).some((error) => error.includes("older than 24 hours")),
  );
  assert.ok(
    validateReviewBinding({
      ...valid,
      reviewedAt: "2026-07-26T12:05:01.000Z",
    }).some((error) => error.includes("future")),
  );
});
