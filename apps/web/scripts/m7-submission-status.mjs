const COMMIT = /^[0-9a-f]{40}$/u;
const HTTPS_URL = /^https:\/\/[^\s]+$/u;
const GATE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const REQUIRED_GATE_IDS = new Set([
  "public-repository",
  "local-verification",
  "hosted-supabase",
  "frontend-deployment",
  "world-runtime",
  "world-submission-metadata",
  "ens-live-integration",
  "registry-deployment",
  "event-submission-target",
]);

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

const rejectSensitiveKeys = (errors, value, path = "$") => {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      rejectSensitiveKeys(errors, entry, `${path}[${index}]`),
    );
    return;
  }
  if (!isObject(value)) return;

  for (const [key, entry] of Object.entries(value)) {
    if (
      /(?:private.?key|mnemonic|seed.?phrase|raw.?transaction|signature|bearer|secret|credential)/iu.test(
        key,
      )
    ) {
      add(errors, `${path}.${key}`, "secret or signed material is forbidden");
    }
    rejectSensitiveKeys(errors, entry, `${path}.${key}`);
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
      (!HTTPS_URL.test(status.hosting.productionUrl ?? "") ||
        !COMMIT.test(status.hosting.deployedCommit ?? ""))
    ) {
      add(
        errors,
        "$.hosting",
        "production hosting requires an HTTPS URL and full deployed commit",
      );
    }
    if (
      status.hosting.status === "not-provisioned" &&
      [status.hosting.projectId, status.hosting.productionUrl].some(
        (value) => value !== null,
      )
    ) {
      add(
        errors,
        "$.hosting",
        "not-provisioned hosting cannot claim a project or production URL",
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
    for (const key of [
      "parent",
      "safeAddress",
      "registrarAddress",
      "signerAddress",
    ]) {
      checkNonEmptyString(errors, `$.ens.${key}`, status.ens[key]);
    }
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
      checkNonEmptyString(
        errors,
        `$.registries.${key}`,
        status.registries[key],
      );
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
  if (
    status.hosting?.status !== "production" &&
    byId.get("frontend-deployment")?.status === "passed"
  ) {
    add(
      errors,
      "$.requiredGates.frontend-deployment",
      "cannot pass without production hosting",
    );
  }
  if (
    status.supabase?.hostedSchemaCurrent !== true &&
    byId.get("hosted-supabase")?.status === "passed"
  ) {
    add(
      errors,
      "$.requiredGates.hosted-supabase",
      "cannot pass while the hosted schema is behind",
    );
  }
  if (
    status.ens?.status !== "provisioned" &&
    byId.get("ens-live-integration")?.status === "passed"
  ) {
    add(
      errors,
      "$.requiredGates.ens-live-integration",
      "cannot pass without provisioned ENS infrastructure",
    );
  }
  if (
    status.registries?.status !== "deployed" &&
    byId.get("registry-deployment")?.status === "passed"
  ) {
    add(
      errors,
      "$.requiredGates.registry-deployment",
      "cannot pass without deployed registries",
    );
  }
  if (
    [
      status.target?.event,
      status.target?.submissionPortal,
      status.target?.deadline,
    ].some((value) => value === null) &&
    byId.get("event-submission-target")?.status === "passed"
  ) {
    add(
      errors,
      "$.requiredGates.event-submission-target",
      "cannot pass while event fields are unresolved",
    );
  }
};

export const validateSubmissionStatus = (status) => {
  const errors = [];
  if (!isObject(status)) return ["$: must be an object"];

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
  checkStringArray(errors, "$.explicitNonActions", status.explicitNonActions, {
    nonEmpty: true,
  });
  rejectSensitiveKeys(errors, status);
  return [...new Set(errors)];
};

export const summarizeSubmissionStatus = (status) => {
  const validationErrors = validateSubmissionStatus(status);
  const gates = Array.isArray(status?.requiredGates)
    ? status.requiredGates
    : [];
  const blockedGates = gates.filter((gate) => gate.status === "blocked");
  const passedGates = gates.filter((gate) => gate.status === "passed");
  const readyForSubmission =
    validationErrors.length === 0 &&
    blockedGates.length === 0 &&
    status.hosting?.status === "production" &&
    status.supabase?.hostedSchemaCurrent === true;
  const readyForDeployment =
    validationErrors.length === 0 &&
    status.registries?.status === "deployed" &&
    status.registries?.unsignedSimulationStatus === "passed" &&
    status.registries?.independentReviewStatus === "approved";

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
