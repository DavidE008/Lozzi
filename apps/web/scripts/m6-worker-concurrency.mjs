import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const pnpmExecutable = process.env.npm_execpath ? process.execPath : "pnpm";
const pnpmPrefix = process.env.npm_execpath ? [process.env.npm_execpath] : [];
const status = spawnSync(
  pnpmExecutable,
  [...pnpmPrefix, "exec", "supabase", "status", "-o", "env"],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  },
);

if (status.status !== 0) {
  throw new Error("Local Supabase must be running for the worker race check.");
}

const localEnvironment = Object.fromEntries(
  status.stdout
    .split(/\r?\n/u)
    .map((line) => line.match(/^([A-Z_]+)="(.*)"$/u))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);
const apiUrl = localEnvironment.API_URL;
const publishableKey =
  localEnvironment.PUBLISHABLE_KEY ?? localEnvironment.ANON_KEY;
const serviceKey =
  localEnvironment.SERVICE_ROLE_KEY ?? localEnvironment.SECRET_KEY;

if (!apiUrl || !publishableKey || !serviceKey) {
  throw new Error("Local Supabase status did not return the required keys.");
}

const service = createClient(apiUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const student = createClient(apiUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const studentId = "13000000-0000-4000-8000-000000000101";
const institutionId = "10000000-0000-4000-8000-000000000001";
const studentUserId = "00000000-0000-4000-8000-000000000101";
const draftId = randomUUID();
const idempotencyKey = randomUUID();
const tokenHash = `\\x${randomBytes(32).toString("hex")}`;
const grantCommitment = `\\x${randomBytes(32).toString("hex")}`;
const institutionCommitment = `\\x${"a4".repeat(32)}`;
const studentCommitment = `\\x${"b4".repeat(32)}`;

const { data: recordVersion, error: recordError } = await service
  .from("academic_record_versions")
  .select("id")
  .eq("student_id", studentId)
  .eq("is_current", true)
  .single();
if (recordError || !recordVersion) {
  throw new Error("Current synthetic academic version was not found.");
}

const now = Date.now();
const { error: draftError } = await service.from("record_share_drafts").insert({
  id: draftId,
  institution_id: institutionId,
  student_id: studentId,
  academic_record_version_id: recordVersion.id,
  recipient_label: "Synthetic worker race verifier",
  scopes: ["record-summary"],
  status: "ready",
  draft_expires_at: new Date(now + 20 * 60_000).toISOString(),
  grant_expires_at: new Date(now + 30 * 60_000).toISOString(),
  adult_attested_at: new Date(now).toISOString(),
  liveness_verified_at: new Date(now).toISOString(),
  idempotency_key: idempotencyKey,
  created_by: studentUserId,
});
if (draftError) {
  throw new Error(`Worker race fixture creation failed: ${draftError.code}`);
}

const { error: signInError } = await student.auth.signInWithPassword({
  email: "aisha.demo@lozzi.example",
  password: "Northstar-Demo-2026!",
});
if (signInError) {
  throw new Error(`Synthetic student sign-in failed: ${signInError.code}`);
}

const { data: activation, error: activationError } = await student.rpc(
  "activate_sensitive_share_with_outbox",
  {
    p_commitment_environment: "test",
    p_correlation_id: randomUUID(),
    p_draft_id: draftId,
    p_grant_commitment: grantCommitment,
    p_institution_commitment: institutionCommitment,
    p_institution_commitment_key_version: 1,
    p_student_commitment: studentCommitment,
    p_student_commitment_key_version: 1,
    p_token_hash: tokenHash,
    p_trace_id: randomUUID(),
  },
);
if (activationError || !activation?.shareGrantId) {
  throw new Error(`Worker race activation failed: ${activationError?.code}`);
}

const claimParameters = {
  p_batch_size: 1,
  p_lease_seconds: 60,
  p_phase: "submission",
};
const [first, second] = await Promise.all([
  service.rpc("claim_m6_outbox_events", {
    ...claimParameters,
    p_worker_id: "worker.race.first",
  }),
  service.rpc("claim_m6_outbox_events", {
    ...claimParameters,
    p_worker_id: "worker.race.second",
  }),
]);
if (first.error || second.error) {
  throw new Error(
    `Concurrent worker claim failed: ${first.error?.code ?? second.error?.code}`,
  );
}

const claimed = [
  ...(Array.isArray(first.data) ? first.data : []),
  ...(Array.isArray(second.data) ? second.data : []),
];
if (claimed.length !== 1) {
  throw new Error(`Expected one claimed event, received ${claimed.length}.`);
}

const winner =
  Array.isArray(first.data) && first.data.length === 1
    ? "worker.race.first"
    : "worker.race.second";
const event = claimed[0];
const completionParameters = {
  p_attempt_number: event.attempt_number,
  p_chain_id: null,
  p_confirmation_count: null,
  p_error_code: null,
  p_event_id: event.event_id,
  p_expected_confirmations: null,
  p_outcome: "simulation_succeeded",
  p_provider_operation_id: null,
  p_receipt_state: "simulation_succeeded",
  p_retry_after_seconds: null,
  p_transaction_hash: null,
  p_worker_id: winner,
};
const completion = await service.rpc(
  "complete_m6_outbox_event",
  completionParameters,
);
if (completion.error || completion.data?.status !== "simulation_succeeded") {
  throw new Error(
    `Worker race completion failed: ${completion.error?.code ?? "invalid"}`,
  );
}

const replay = await service.rpc(
  "complete_m6_outbox_event",
  completionParameters,
);
if (replay.error || replay.data?.idempotentReplay !== true) {
  throw new Error(
    `Worker completion replay failed: ${replay.error?.code ?? "invalid"}`,
  );
}

const { data: persisted, error: persistedError } = await service
  .from("outbox_events")
  .select("attempts, claim_owner, status")
  .eq("id", event.event_id)
  .single();
if (
  persistedError ||
  persisted?.attempts !== 1 ||
  persisted?.claim_owner !== null ||
  persisted?.status !== "simulation_succeeded"
) {
  throw new Error("Worker race did not persist exactly one terminal attempt.");
}

await student.auth.signOut();
process.stdout.write(
  "Milestone 6 worker concurrency check passed: 2 workers, 1 claim, 1 idempotent completion.\n",
);
