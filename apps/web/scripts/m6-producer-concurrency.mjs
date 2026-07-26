import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
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
  throw new Error("Local Supabase must be running for the concurrency check.");
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
  localEnvironment.SECRET_KEY ?? localEnvironment.SERVICE_ROLE_KEY;

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
const tokenHash = `\\x${"d3".repeat(32)}`;
const grantCommitment = `\\x${"d4".repeat(32)}`;
const institutionCommitment = `\\x${"a3".repeat(32)}`;
const studentCommitment = `\\x${"b3".repeat(32)}`;

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
  recipient_label: "Synthetic concurrency verifier",
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
  throw new Error(`Concurrency fixture creation failed: ${draftError.code}`);
}

const { error: signInError } = await student.auth.signInWithPassword({
  email: "aisha.demo@lozzi.example",
  password: "Northstar-Demo-2026!",
});
if (signInError) {
  throw new Error(`Synthetic student sign-in failed: ${signInError.code}`);
}

const parameters = {
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
};
const [first, second] = await Promise.all([
  student.rpc("activate_sensitive_share_with_outbox", parameters),
  student.rpc("activate_sensitive_share_with_outbox", {
    ...parameters,
    p_correlation_id: randomUUID(),
    p_trace_id: randomUUID(),
  }),
]);

if (first.error || second.error) {
  throw new Error(
    `Concurrent activation failed: ${first.error?.code ?? second.error?.code}`,
  );
}

const results = [first.data, second.data];
if (
  results.some((result) => result?.status !== "active") ||
  results.filter((result) => result?.idempotentReplay === true).length !== 1
) {
  throw new Error(
    "Concurrent activation did not resolve as one write and one replay.",
  );
}

const grantId = first.data.shareGrantId;
if (grantId !== second.data.shareGrantId) {
  throw new Error("Concurrent activation created different share grants.");
}

const [{ count: grantCount }, { count: eventCount }] = await Promise.all([
  service
    .from("record_share_grants")
    .select("id", { count: "exact", head: true })
    .eq("id", grantId),
  service
    .from("outbox_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "share_grant.create.requested.v1")
    .eq("aggregate_id", grantId),
]);

if (grantCount !== 1 || eventCount !== 1) {
  throw new Error("Concurrent activation duplicated domain or outbox state.");
}

await student.auth.signOut();
process.stdout.write(
  "Milestone 6 producer concurrency check passed: 1 grant, 1 logical event.\n",
);
