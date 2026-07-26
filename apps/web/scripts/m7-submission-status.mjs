import { readFileSync } from "node:fs";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const COMMIT = /^[0-9a-f]{40}$/u;
const HTTPS_URL = /^https:\/\/[^\s]+$/u;
const ETHEREUM_ADDRESS = /^0x[0-9a-fA-F]{40}$/u;
const GATE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const PRIVATE_KEY = /\b0x[0-9a-fA-F]{64}\b/u;
const SIGNATURE = /\b0x[0-9a-fA-F]{128,130}\b/u;
const TOKEN =
  /\b(?:api_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|gh[oprsu]_[A-Za-z0-9]{20,}|s[bb]_(?:secret|publishable)_[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{20,}|(?:sk|rk)_(?:live|test)_[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/u;
const ASSIGNED_SECRET =
  /\b(?:access.?token|api.?key|authorization|bearer|credential|mnemonic|private.?key|raw.?transaction|refresh.?token|secret|seed.?phrase|signature|token)\s*[:=]\s*\S+/iu;
const PEM_PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----/u;

const REQUIRED_GATE_IDS = new Set([
  "public-repository",
  "local-verification",
  "dependency-security",
  "hosted-supabase",
  "frontend-deployment",
  "world-runtime",
  "world-submission-metadata",
  "ens-live-integration",
  "registry-deployment",
  "event-submission-target",
]);

const DEPLOYMENT_GATE_IDS = new Set([
  "public-repository",
  "local-verification",
  "dependency-security",
  "registry-deployment",
]);

const MAXIMUM_REVIEW_AGE_MILLISECONDS = 24 * 60 * 60 * 1_000;
const MAXIMUM_CLOCK_SKEW_MILLISECONDS = 5 * 60 * 1_000;

const schema = JSON.parse(
  readFileSync(
    new URL(
      "../../../deployment/milestone-7/submission-status.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

const isObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const add = (errors, path, message) => errors.push(`${path}: ${message}`);

const checkNonEmptyString = (errors, path, value) => {
  if (typeof value !== "string" || value.trim() === "") {
    add(errors, path, "must be a non-empty string");
    return false;
  }
  return true;
};

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim() !== "";

export const validateEvidencePathSyntax = (value) => {
  if (!isNonEmptyString(value)) {
    return ["must be a non-empty repository-relative path"];
  }
  if (
    value.includes("\\") ||
    path.posix.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    path.posix.normalize(value) !== value ||
    value.split("/").some((segment) => ["", ".", ".."].includes(segment))
  ) {
    return ["must be a normalized repository-relative path"];
  }
  return [];
};

const checkAddress = (errors, path, value) => {
  if (typeof value !== "string" || !ETHEREUM_ADDRESS.test(value)) {
    add(errors, path, "must be a 20-byte Ethereum address");
    return false;
  }
  return true;
};

const checkStringArray = (errors, path, value, { nonEmpty = false } = {}) => {
  if (!Array.isArray(value)) {
    add(errors, path, "must be an array");
    return false;
  }
  if (nonEmpty && value.length === 0) {
    add(errors, path, "must not be empty");
  }
  value.forEach((entry, index) =>
    checkNonEmptyString(errors, `${path}[${index}]`, entry),
  );
  return true;
};

const rejectSensitiveMaterial = (errors, value, path = "$") => {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      rejectSensitiveMaterial(errors, entry, `${path}[${index}]`),
    );
    return;
  }
  if (typeof value === "string") {
    if (
      [PRIVATE_KEY, SIGNATURE, TOKEN, ASSIGNED_SECRET, PEM_PRIVATE_KEY].some(
        (pattern) => pattern.test(value),
      )
    ) {
      add(errors, path, "secret or signed material is forbidden");
    }
    return;
  }
  if (!isObject(value)) return;

  for (const [key, entry] of Object.entries(value)) {
    if (
      /(?:access.?token|api.?key|authorization|bearer|credential|mnemonic|private.?key|raw.?transaction|refresh.?token|secret|seed.?phrase|signature|token)/iu.test(
        key,
      )
    ) {
      add(errors, `${path}.${key}`, "secret or signed material is forbidden");
    }
    rejectSensitiveMaterial(errors, entry, `${path}.${key}`);
  }
};

const checkServiceState = (errors, status) => {
  if (!isObject(status.hosting)) {
    add(errors, "$.hosting", "must be an object");
  } else {
    if (
      !["not-provisioned", "preview", "production"].includes(
        status.hosting.status,
      )
    ) {
      add(errors, "$.hosting.status", "has an unsupported value");
    }
    if (
      status.hosting.status === "production" &&
      (!isNonEmptyString(status.hosting.projectId) ||
        !HTTPS_URL.test(status.hosting.productionUrl ?? "") ||
        !COMMIT.test(status.hosting.deployedCommit ?? ""))
    ) {
      add(
        errors,
        "$.hosting",
        "production hosting requires an HTTPS URL and full deployed commit",
      );
    }
    if (status.hosting.status === "preview") {
      if (
        !isNonEmptyString(status.hosting.projectId) ||
        !isNonEmptyString(status.hosting.previewDeploymentId) ||
        !HTTPS_URL.test(status.hosting.previewUrl ?? "") ||
        !COMMIT.test(status.hosting.previewCommit ?? "") ||
        status.hosting.previewState !== "READY" ||
        !Number.isSafeInteger(status.hosting.previewHttpStatus) ||
        status.hosting.previewHttpStatus < 100 ||
        status.hosting.previewHttpStatus > 599 ||
        !["passed", "failed"].includes(status.hosting.previewRuntimeStatus) ||
        status.hosting.productionUrl !== null ||
        status.hosting.deployedCommit !== null
      ) {
        add(
          errors,
          "$.hosting",
          "preview hosting requires exact READY deployment and runtime evidence without a production claim",
        );
      } else if (
        (status.hosting.previewRuntimeStatus === "passed") !==
        (status.hosting.previewHttpStatus >= 200 &&
          status.hosting.previewHttpStatus < 400)
      ) {
        add(
          errors,
          "$.hosting.previewRuntimeStatus",
          "must agree with the observed preview HTTP status",
        );
      }
    }
    if (
      status.hosting.status === "not-provisioned" &&
      ([
        status.hosting.projectId,
        status.hosting.previewDeploymentId,
        status.hosting.previewUrl,
        status.hosting.previewCommit,
        status.hosting.previewHttpStatus,
        status.hosting.productionUrl,
        status.hosting.deployedCommit,
      ].some((value) => value !== null) ||
        status.hosting.previewState !== "not-created" ||
        status.hosting.previewRuntimeStatus !== "not-run")
    ) {
      add(
        errors,
        "$.hosting",
        "not-provisioned hosting cannot claim preview or production evidence",
      );
    }
  }

  if (!isObject(status.supabase)) {
    add(errors, "$.supabase", "must be an object");
  } else {
    for (const key of [
      "authUserCount",
      "studentCount",
      "nonSyntheticAuthUserCount",
      "nonSyntheticStudentCount",
      "localMigrationCount",
      "hostedMigrationCount",
    ]) {
      if (
        !Number.isSafeInteger(status.supabase[key]) ||
        status.supabase[key] < 0
      ) {
        add(errors, `$.supabase.${key}`, "must be a non-negative integer");
      }
    }
    if (
      status.supabase.hostedSchemaCurrent === true &&
      status.supabase.localMigrationCount !==
        status.supabase.hostedMigrationCount
    ) {
      add(
        errors,
        "$.supabase.hostedSchemaCurrent",
        "cannot be true when migration counts differ",
      );
    }
    if (
      status.supabase.nonSyntheticAuthUserCount !== 0 ||
      status.supabase.nonSyntheticStudentCount !== 0
    ) {
      add(
        errors,
        "$.supabase",
        "submission evidence must not claim a synthetic-only environment",
      );
    }
  }

  if (!isObject(status.world)) {
    add(errors, "$.world", "must be an object");
  } else {
    if (status.world.actionRecordCount !== 6) {
      add(
        errors,
        "$.world.actionRecordCount",
        "must equal the six reviewed records",
      );
    }
    if (
      !["registered"].includes(status.world.productionRegistration) ||
      !["registered"].includes(status.world.stagingRegistration)
    ) {
      add(
        errors,
        "$.world",
        "must record the reviewed production and staging registrations",
      );
    }
  }

  if (!isObject(status.ens)) {
    add(errors, "$.ens", "must be an object");
  } else if (status.ens.status === "provisioned") {
    for (const key of ["safeAddress", "registrarAddress", "signerAddress"]) {
      checkAddress(errors, `$.ens.${key}`, status.ens[key]);
    }
    checkNonEmptyString(errors, "$.ens.parent", status.ens.parent);
    if (status.ens.canaryVerified !== true) {
      add(
        errors,
        "$.ens.canaryVerified",
        "must be true before live ENS is submission-ready",
      );
    }
  }

  if (!isObject(status.registries)) {
    add(errors, "$.registries", "must be an object");
  } else if (status.registries.status === "deployed") {
    if (!Number.isSafeInteger(status.registries.approvedChainId)) {
      add(
        errors,
        "$.registries.approvedChainId",
        "must identify the approved deployed chain",
      );
    }
    for (const key of [
      "institutionRegistryAddress",
      "academicRecordRegistryAddress",
    ]) {
      checkAddress(errors, `$.registries.${key}`, status.registries[key]);
    }
    if (
      status.registries.unsignedSimulationStatus !== "passed" ||
      status.registries.independentReviewStatus !== "approved"
    ) {
      add(
        errors,
        "$.registries",
        "deployment claims require passed simulation and approved independent review",
      );
    }
  }

  if (isObject(status.verification)) {
    const severityTotal =
      status.verification.slitherHighFindings +
      status.verification.slitherMediumFindings +
      status.verification.slitherLowFindings;
    if (status.verification.slitherFindingCount !== severityTotal) {
      add(
        errors,
        "$.verification.slitherFindingCount",
        "must equal the sum of high, medium, and low findings",
      );
    }
    if (
      status.verification.slitherStatus === "passed" &&
      status.verification.slitherFindingCount !== 0
    ) {
      add(
        errors,
        "$.verification.slitherStatus",
        "cannot pass while findings are recorded",
      );
    }
  }
};

const localVerificationPassed = (status) => {
  const verification = status.verification;
  return (
    isObject(verification) &&
    verification.domainTests === 55 &&
    verification.webVitestTests === 173 &&
    verification.webScriptTests === 26 &&
    verification.forgeTests === 29 &&
    verification.forgeSuites === 4 &&
    verification.pgTapTests === 413 &&
    verification.pgTapFiles === 13 &&
    verification.playwrightPassed === 17 &&
    verification.playwrightSkipped === 9 &&
    verification.concurrencyChecks === 3
  );
};

const gatePredicate = (id, status) => {
  switch (id) {
    case "public-repository":
      return (
        status.repository?.url === "https://github.com/DavidE008/Lozzi" &&
        status.repository?.defaultBranch === "main" &&
        status.repository?.visibility === "public" &&
        status.repository?.license === "MIT" &&
        status.repository?.issuesEnabled === true &&
        status.repository?.mainQualityStatus === "passed" &&
        HTTPS_URL.test(status.repository?.mainQualityRun ?? "")
      );
    case "local-verification":
      return localVerificationPassed(status);
    case "dependency-security":
      return (
        status.verification?.dependencyAuditThreshold === "moderate" &&
        status.verification?.moderateDependencyAdvisories === 0 &&
        status.verification?.slitherHighFindings === 0
      );
    case "hosted-supabase":
      return (
        status.supabase?.status === "ACTIVE_HEALTHY" &&
        status.supabase?.hostedSchemaCurrent === true &&
        status.supabase?.hostedMigrationCount ===
          status.supabase?.localMigrationCount &&
        status.supabase?.authUserCount > 0 &&
        status.supabase?.studentCount > 0 &&
        status.supabase?.nonSyntheticAuthUserCount === 0 &&
        status.supabase?.nonSyntheticStudentCount === 0
      );
    case "frontend-deployment":
      return (
        status.hosting?.status === "production" &&
        isNonEmptyString(status.hosting?.projectId) &&
        HTTPS_URL.test(status.hosting?.productionUrl ?? "") &&
        COMMIT.test(status.hosting?.deployedCommit ?? "")
      );
    case "world-runtime":
      return (
        status.world?.productionRegistration === "registered" &&
        status.world?.stagingRegistration === "registered" &&
        status.world?.actionRecordCount === 6 &&
        status.world?.signingKeyAvailableLocally === true
      );
    case "world-submission-metadata":
      return (
        status.world?.appReviewStatus === "verified" &&
        status.world?.websiteConfigured === true &&
        status.world?.storeMediaComplete === true
      );
    case "ens-live-integration":
      return (
        status.ens?.status === "provisioned" &&
        isNonEmptyString(status.ens?.parent) &&
        ETHEREUM_ADDRESS.test(status.ens?.safeAddress ?? "") &&
        ETHEREUM_ADDRESS.test(status.ens?.registrarAddress ?? "") &&
        ETHEREUM_ADDRESS.test(status.ens?.signerAddress ?? "") &&
        status.ens?.canaryVerified === true
      );
    case "registry-deployment":
      return (
        status.registries?.status === "deployed" &&
        Number.isSafeInteger(status.registries?.approvedChainId) &&
        status.registries.approvedChainId > 0 &&
        ETHEREUM_ADDRESS.test(
          status.registries?.institutionRegistryAddress ?? "",
        ) &&
        ETHEREUM_ADDRESS.test(
          status.registries?.academicRecordRegistryAddress ?? "",
        ) &&
        status.registries?.unsignedSimulationStatus === "passed" &&
        status.registries?.independentReviewStatus === "approved"
      );
    case "event-submission-target": {
      const reviewedAt = Date.parse(status.reviewedAt ?? "");
      const deadline = Date.parse(status.target?.deadline ?? "");
      return (
        isNonEmptyString(status.target?.event) &&
        HTTPS_URL.test(status.target?.submissionPortal ?? "") &&
        Number.isFinite(reviewedAt) &&
        Number.isFinite(deadline) &&
        deadline > reviewedAt
      );
    }
    default:
      return false;
  }
};

const checkGates = (errors, status) => {
  if (!Array.isArray(status.requiredGates)) {
    add(errors, "$.requiredGates", "must be an array");
    return;
  }

  const gateIds = new Set();
  status.requiredGates.forEach((gate, index) => {
    const path = `$.requiredGates[${index}]`;
    if (!isObject(gate)) {
      add(errors, path, "must be an object");
      return;
    }
    if (typeof gate.id !== "string" || !GATE_ID.test(gate.id)) {
      add(errors, `${path}.id`, "must be a lowercase kebab-case identifier");
    } else if (gateIds.has(gate.id)) {
      add(errors, `${path}.id`, "must be unique");
    } else if (!REQUIRED_GATE_IDS.has(gate.id)) {
      add(errors, `${path}.id`, "is not a recognized required gate");
    } else {
      gateIds.add(gate.id);
    }
    if (!["passed", "blocked"].includes(gate.status)) {
      add(errors, `${path}.status`, "must be passed or blocked");
    }
    checkStringArray(errors, `${path}.evidence`, gate.evidence, {
      nonEmpty: true,
    });
    if (checkStringArray(errors, `${path}.blockers`, gate.blockers)) {
      if (gate.status === "passed" && gate.blockers.length > 0) {
        add(errors, `${path}.blockers`, "must be empty for a passed gate");
      }
      if (gate.status === "blocked" && gate.blockers.length === 0) {
        add(errors, `${path}.blockers`, "must explain why the gate is blocked");
      }
    }
  });

  for (const required of REQUIRED_GATE_IDS) {
    if (!gateIds.has(required)) {
      add(errors, "$.requiredGates", `is missing ${required}`);
    }
  }

  const byId = new Map(
    status.requiredGates
      .filter((gate) => isObject(gate))
      .map((gate) => [gate.id, gate]),
  );
  for (const id of REQUIRED_GATE_IDS) {
    if (byId.get(id)?.status === "passed" && !gatePredicate(id, status)) {
      add(
        errors,
        `$.requiredGates.${id}`,
        "cannot pass because its typed readiness predicate is false",
      );
    }
  }
};

export const validateSubmissionStatus = (status) => {
  const errors = [];
  if (!isObject(status)) return ["$: must be an object"];

  if (!validateSchema(status)) {
    for (const error of validateSchema.errors ?? []) {
      add(
        errors,
        error.instancePath ? `$${error.instancePath}` : "$",
        error.message ?? "does not match the submission status schema",
      );
    }
  }

  if (status.schemaVersion !== "lozzi.m7.submission-status.v1") {
    add(errors, "$.schemaVersion", "must equal lozzi.m7.submission-status.v1");
  }
  if (
    typeof status.reviewedAt !== "string" ||
    Number.isNaN(Date.parse(status.reviewedAt))
  ) {
    add(errors, "$.reviewedAt", "must be an ISO-8601 timestamp");
  }
  if (
    typeof status.basisCommit !== "string" ||
    !COMMIT.test(status.basisCommit)
  ) {
    add(errors, "$.basisCommit", "must be a full lowercase Git commit");
  }
  if (!isObject(status.target)) {
    add(errors, "$.target", "must be an object");
  } else {
    if (
      status.target.submissionPortal !== null &&
      !HTTPS_URL.test(status.target.submissionPortal ?? "")
    ) {
      add(errors, "$.target.submissionPortal", "must be an HTTPS URL or null");
    }
    if (
      status.target.deadline !== null &&
      Number.isNaN(Date.parse(status.target.deadline))
    ) {
      add(errors, "$.target.deadline", "must be an ISO-8601 timestamp or null");
    }
  }
  if (!isObject(status.repository)) {
    add(errors, "$.repository", "must be an object");
  } else {
    if (status.repository.url !== "https://github.com/DavidE008/Lozzi") {
      add(errors, "$.repository.url", "must identify the reviewed repository");
    }
    if (
      status.repository.defaultBranch !== "main" ||
      status.repository.visibility !== "public" ||
      status.repository.license !== "MIT" ||
      status.repository.issuesEnabled !== true
    ) {
      add(
        errors,
        "$.repository",
        "must record public main, MIT licensing, and enabled issues",
      );
    }
  }

  checkServiceState(errors, status);
  checkGates(errors, status);
  checkStringArray(errors, "$.evidencePaths", status.evidencePaths, {
    nonEmpty: true,
  });
  if (Array.isArray(status.evidencePaths)) {
    status.evidencePaths.forEach((evidencePath, index) => {
      for (const message of validateEvidencePathSyntax(evidencePath)) {
        add(errors, `$.evidencePaths[${index}]`, message);
      }
    });
  }
  checkStringArray(errors, "$.explicitNonActions", status.explicitNonActions, {
    nonEmpty: true,
  });
  rejectSensitiveMaterial(errors, status);
  return [...new Set(errors)];
};

export const summarizeSubmissionStatus = (status) => {
  const validationErrors = validateSubmissionStatus(status);
  const gates = Array.isArray(status?.requiredGates)
    ? status.requiredGates
    : [];
  const blockedGates = gates.filter((gate) => gate.status === "blocked");
  const passedGates = gates.filter((gate) => gate.status === "passed");
  const byId = new Map(
    gates.filter((gate) => isObject(gate)).map((gate) => [gate.id, gate]),
  );
  const allGatesPassed = [...REQUIRED_GATE_IDS].every(
    (id) => byId.get(id)?.status === "passed" && gatePredicate(id, status),
  );
  const deploymentGatesPassed = [...DEPLOYMENT_GATE_IDS].every(
    (id) => byId.get(id)?.status === "passed" && gatePredicate(id, status),
  );
  const readyForSubmission =
    validationErrors.length === 0 &&
    blockedGates.length === 0 &&
    allGatesPassed;
  const readyForDeployment =
    validationErrors.length === 0 && deploymentGatesPassed;

  return {
    basisCommit: status?.basisCommit ?? null,
    broadcast: false,
    externalMutation: false,
    readyForDeployment,
    readyForSubmission,
    requiredGateCount: gates.length,
    passedGateCount: passedGates.length,
    blockedGateCount: blockedGates.length,
    blockedGates: blockedGates.map((gate) => ({
      id: gate.id,
      blockers: gate.blockers,
    })),
    validationErrors,
  };
};

export const validateReviewBinding = ({
  changedPaths,
  reviewedAt,
  statusPath,
  worktreeStatus,
  now = Date.now(),
}) => {
  const errors = [];
  const reviewedAtMilliseconds = Date.parse(reviewedAt ?? "");
  if (Number.isFinite(reviewedAtMilliseconds)) {
    if (reviewedAtMilliseconds > now + MAXIMUM_CLOCK_SKEW_MILLISECONDS) {
      errors.push("$.reviewedAt: cannot be materially in the future");
    } else if (now - reviewedAtMilliseconds > MAXIMUM_REVIEW_AGE_MILLISECONDS) {
      errors.push(
        "$.reviewedAt: live readiness evidence is older than 24 hours",
      );
    }
  }

  const unreviewedPaths = changedPaths.filter((file) => file !== statusPath);
  if (unreviewedPaths.length > 0) {
    errors.push(
      `$.basisCommit: unreviewed paths changed after the reviewed commit: ${unreviewedPaths.join(", ")}`,
    );
  }
  if (worktreeStatus.trim() !== "") {
    errors.push(
      "working tree: tracked or untracked changes are outside the reviewed evidence",
    );
  }
  return errors;
};
