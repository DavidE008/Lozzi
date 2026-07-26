import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  summarizeSubmissionStatus,
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

test("rejects secret or signed material anywhere in the evidence", () => {
  const candidate = clone(status);
  candidate.world.privateKey = "forbidden";
  candidate.registries.rawTransaction = "0xdeadbeef";

  const errors = validateSubmissionStatus(candidate);
  assert.ok(errors.some((error) => error.includes("$.world.privateKey")));
  assert.ok(
    errors.some((error) => error.includes("$.registries.rawTransaction")),
  );
});

test("rejects a passed gate when its underlying live state is absent", () => {
  const candidate = clone(status);
  candidate.requiredGates.find(
    (gate) => gate.id === "frontend-deployment",
  ).status = "passed";
  candidate.requiredGates.find(
    (gate) => gate.id === "frontend-deployment",
  ).blockers = [];

  const errors = validateSubmissionStatus(candidate);
  assert.ok(
    errors.some((error) =>
      error.includes("$.requiredGates.frontend-deployment"),
    ),
  );
});

test("requires the exact event, portal, and deadline before submission", () => {
  const candidate = clone(status);
  candidate.requiredGates.find(
    (gate) => gate.id === "event-submission-target",
  ).status = "passed";
  candidate.requiredGates.find(
    (gate) => gate.id === "event-submission-target",
  ).blockers = [];

  const errors = validateSubmissionStatus(candidate);
  assert.ok(
    errors.some((error) =>
      error.includes("$.requiredGates.event-submission-target"),
    ),
  );
});
