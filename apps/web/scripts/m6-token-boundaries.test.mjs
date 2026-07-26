import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path) =>
  readFile(new URL(`../src/${path}`, import.meta.url), "utf8");

test("keeps public verifier bearer tokens out of URLs, logs, and RPC arguments", async () => {
  const [form, route, service] = await Promise.all([
    source("components/public-verifier/verifier-form.tsx"),
    source("app/api/verify/route.ts"),
    source("lib/public-verifier/service.ts"),
  ]);

  assert.match(form, /body: JSON\.stringify\(\{ token: submittedToken \}\)/u);
  assert.match(
    form,
    /window\.history\.replaceState\(null, "", window\.location\.pathname\)/u,
  );
  assert.doesNotMatch(form, /\?token=/u);

  assert.match(route, /searchParams\.has\("token"\)/u);
  const logCall = route.slice(
    route.indexOf('logEvent("warn"'),
    route.indexOf("return NextResponse.json", route.indexOf('logEvent("warn"')),
  );
  assert.doesNotMatch(logCall, /\binput\b|\btoken\b/u);

  assert.match(service, /p_token_hash: bytea\(tokenHash\(input\.token\)\)/u);
  assert.doesNotMatch(service, /\bp_token\s*:/u);
});
