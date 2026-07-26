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
const { error: signInError } = await student.auth.signInWithPassword({
  email: "aisha.demo@lozzi.example",
  password: "Northstar-Demo-2026!",
});
if (signInError) {
  throw new Error(`Synthetic student sign-in failed: ${signInError.code}`);
}

const { data: draft, error: draftError } = await student.rpc(
  "create_minimum_scope_share_draft",
  {
    p_academic_record_version_id: recordVersion.id,
    p_grant_duration_minutes: 30,
    p_idempotency_key: idempotencyKey,
    p_recipient_label: "Synthetic concurrency verifier",
    p_scopes: ["record-summary"],
    p_student_id: studentId,
  },
);
if (draftError || !draft?.draftId) {
  throw new Error(`Concurrency fixture creation failed: ${draftError?.code}`);
}
const draftId = draft.draftId;
const { error: readinessError } = await service
  .from("record_share_drafts")
  .update({
    adult_attested_at: new Date(now).toISOString(),
    liveness_verified_at: new Date(now).toISOString(),
    status: "ready",
  })
  .eq("id", draftId);
if (readinessError) {
  throw new Error(
    `Concurrency fixture readiness failed: ${readinessError.code}`,
  );
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

const [firstRevocation, secondRevocation] = await Promise.all([
  student.rpc("revoke_sensitive_share_with_outbox", {
    p_correlation_id: randomUUID(),
    p_idempotency_key: randomUUID(),
    p_share_grant_id: grantId,
    p_trace_id: randomUUID(),
  }),
  student.rpc("revoke_sensitive_share_with_outbox", {
    p_correlation_id: randomUUID(),
    p_idempotency_key: randomUUID(),
    p_share_grant_id: grantId,
    p_trace_id: randomUUID(),
  }),
]);

if (firstRevocation.error || secondRevocation.error) {
  throw new Error(
    `Concurrent revocation failed: ${
      firstRevocation.error?.code ?? secondRevocation.error?.code
    }`,
  );
}

const revocations = [firstRevocation.data, secondRevocation.data];
if (
  revocations.some((result) => result?.status !== "revoked") ||
  revocations.filter((result) => result?.idempotentReplay === true).length !== 1
) {
  throw new Error(
    "Concurrent revocation did not resolve as one write and one replay.",
  );
}

const [
  { count: revokedGrantCount },
  { count: revocationEventCount },
  { count: revocationAuditCount },
] = await Promise.all([
  service
    .from("record_share_grants")
    .select("id", { count: "exact", head: true })
    .eq("id", grantId)
    .eq("status", "revoked"),
  service
    .from("outbox_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "share_grant.revoke.requested.v1")
    .eq("aggregate_id", grantId),
  service
    .from("audit_events")
    .select("id", { count: "exact", head: true })
    .eq("action", "share.sensitive.revoke")
    .eq("entity_id", grantId),
]);

if (
  revokedGrantCount !== 1 ||
  revocationEventCount !== 1 ||
  revocationAuditCount !== 1
) {
  throw new Error(
    "Concurrent revocation duplicated or omitted durable lifecycle state.",
  );
}

await student.auth.signOut();
process.stdout.write(
  "Milestone 6 producer concurrency check passed: 1 grant, 1 create event, 1 revocation event.\n",
);
