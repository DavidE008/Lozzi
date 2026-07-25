import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split(/\r?\n/u)
  .filter(Boolean);

const rules = [
  { label: "Supabase service-role JWT", pattern: /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/u },
  { label: "private key", pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/u },
  { label: "generic secret assignment", pattern: /(?:secret|private_key)\s*=\s*["'][^"'$<]{16,}["']/iu },
];

const findings = [];
for (const file of trackedFiles) {
  if (/\.(?:png|jpg|jpeg|gif|woff2?|lock)$/iu.test(file)) continue;
  const content = await readFile(file, "utf8").catch(() => "");
  for (const rule of rules) {
    if (rule.pattern.test(content)) findings.push(`${file}: ${rule.label}`);
  }
}

if (findings.length) {
  console.error(`Potential secrets found:\n${findings.join("\n")}`);
  process.exit(1);
}

console.log(`Secret scan passed (${trackedFiles.length} tracked files).`);
