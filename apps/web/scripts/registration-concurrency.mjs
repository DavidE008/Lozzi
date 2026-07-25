import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const readSupabaseEnvironment = (name) => {
  const rawValue = process.env[name];
  assert(rawValue, `${name} is required.`);

  const hasWrappingQuotes =
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"));

  return hasWrappingQuotes ? rawValue.slice(1, -1) : rawValue;
};

const supabaseUrl = readSupabaseEnvironment("API_URL");
const supabaseAnonKey = readSupabaseEnvironment("ANON_KEY");
const supabaseServiceRoleKey = readSupabaseEnvironment("SERVICE_ROLE_KEY");
const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const createStudentClient = async (email, password) => {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  return client;
};

const rpc = async (client, name, parameters) => {
  const { data, error } = await client.rpc(name, parameters);
  assert.ifError(error);
  assert(data && typeof data === "object", `${name} must return an object.`);
  return data;
};

const catalog = async (client) => {
  const { data, error } = await client.rpc("get_registration_catalog");
  assert.ifError(error);
  assert(Array.isArray(data), "Registration catalog must be an array.");
  return data;
};

const aisha = await createStudentClient(
  "aisha.demo@lozzi.example",
  "Northstar-Demo-2026!",
);
const mateo = await createStudentClient(
  "mateo.demo@lozzi.example",
  "Synthetic-Only-2026!",
);

const dataStructuresSectionId = "60000000-0000-4000-8000-000000000001";
const setSectionCapacity = async (capacity) => {
  const { error } = await admin
    .from("course_sections")
    .update({ capacity })
    .eq("id", dataStructuresSectionId);
  assert.ifError(error);
};

const aishaSection = (await catalog(aisha)).find(
  ({ section_id: sectionId }) => sectionId === dataStructuresSectionId,
);
assert(aishaSection?.enrollment_id, "Aisha's seeded enrollment is required.");

const dropResult = await rpc(aisha, "withdraw_from_section", {
  p_enrollment_id: aishaSection.enrollment_id,
  p_idempotency_key: randomUUID(),
});
assert.equal(
  dropResult.success,
  true,
  "The concurrency fixture must free one seat.",
);
await setSectionCapacity(1);

const [aishaAttempt, mateoAttempt] = await Promise.all([
  rpc(aisha, "register_for_sections", {
    p_section_ids: [dataStructuresSectionId],
    p_idempotency_key: randomUUID(),
  }),
  rpc(mateo, "register_for_sections", {
    p_section_ids: [dataStructuresSectionId],
    p_idempotency_key: randomUUID(),
  }),
]);

const attempts = [aishaAttempt, mateoAttempt];
assert.equal(
  attempts.filter(({ success }) => success).length,
  1,
  "Exactly one concurrent request must receive the final seat.",
);
assert.equal(
  attempts.filter(({ success }) => !success).length,
  1,
  "Exactly one concurrent request must be rejected.",
);

const rejected = attempts.find(({ success }) => !success);
assert(
  rejected.eligibility.some(({ eligibility }) =>
    eligibility.blockingReasons.some(({ code }) => code === "SECTION_FULL"),
  ),
  "The losing request must receive SECTION_FULL.",
);

const finalSection = (await catalog(aisha)).find(
  ({ section_id: sectionId }) => sectionId === dataStructuresSectionId,
);
assert.equal(
  finalSection?.enrolled_count,
  1,
  "The section must not over-enrol.",
);

if (mateoAttempt.success) {
  const mateoSection = (await catalog(mateo)).find(
    ({ section_id: sectionId }) => sectionId === dataStructuresSectionId,
  );
  assert(
    mateoSection?.enrollment_id,
    "Mateo's winning enrollment is required.",
  );
  await rpc(mateo, "withdraw_from_section", {
    p_enrollment_id: mateoSection.enrollment_id,
    p_idempotency_key: randomUUID(),
  });
  const restoreResult = await rpc(aisha, "register_for_sections", {
    p_section_ids: [dataStructuresSectionId],
    p_idempotency_key: randomUUID(),
  });
  assert.equal(
    restoreResult.success,
    true,
    "The seed enrollment must be restored.",
  );
}

await setSectionCapacity(2);

console.log(
  "Registration concurrency test passed: one final seat, one winner.",
);
