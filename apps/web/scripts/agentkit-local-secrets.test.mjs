import assert from "node:assert/strict";
import test from "node:test";

import {
  parseDemoBaseUrl,
  protectPasswordForCurrentWindowsUser,
  unprotectPasswordForCurrentWindowsUser,
} from "./agentkit-local-secrets.mjs";

test("permits HTTPS and explicit loopback HTTP origins", () => {
  assert.equal(
    parseDemoBaseUrl("https://lozzi.example"),
    "https://lozzi.example",
  );
  assert.equal(
    parseDemoBaseUrl("http://localhost:3000"),
    "http://localhost:3000",
  );
  assert.equal(
    parseDemoBaseUrl("http://127.0.0.1:3000"),
    "http://127.0.0.1:3000",
  );
  assert.equal(parseDemoBaseUrl("http://[::1]:3000"), "http://[::1]:3000");
});

test("rejects remote cleartext and non-origin destinations", () => {
  assert.throws(() => parseDemoBaseUrl("http://example.com"), /HTTPS/u);
  assert.throws(
    () => parseDemoBaseUrl("https://lozzi.example/path"),
    /only an origin/u,
  );
  assert.throws(
    () => parseDemoBaseUrl("https://user:pass@lozzi.example"),
    /only an origin/u,
  );
});

test(
  "round-trips a password through the current Windows user protector",
  { skip: process.platform !== "win32" },
  async () => {
    const password = "synthetic-test-password";
    const protectedPassword =
      await protectPasswordForCurrentWindowsUser(password);
    assert.notEqual(protectedPassword, password);
    assert.equal(
      await unprotectPasswordForCurrentWindowsUser(protectedPassword),
      password,
    );
  },
);
