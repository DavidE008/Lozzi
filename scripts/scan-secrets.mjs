import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const repositoryFiles = [
  execFileSync("git", ["ls-files"], { encoding: "utf8" }),
  execFileSync("git", ["ls-files", "--others", "--exclude-standard"], {
    encoding: "utf8",
  }),
]
  .join("\n")
  .split(/\r?\n/u)
  .filter(Boolean);

const rules = [
  {
    label: "Supabase service-role JWT",
    pattern: /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/u,
  },
  {
    label: "private key",
    pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/u,
  },
  {
    label: "World Developer API key",
    pattern: /api_[A-Za-z0-9_-]{40,}/u,
  },
  {
    label: "generic secret assignment",
    pattern: /(?:secret|private_key)\s*=\s*["'][^"'$<]{16,}["']/iu,
  },
];

const findings = [];
for (const file of repositoryFiles) {
  if (/\.(?:png|jpg|jpeg|gif|woff2?|lock)$/iu.test(file)) continue;
  const content = (await readFile(file, "utf8").catch(() => ""))
    .split(/\r?\n/u)
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n")
    .replaceAll(/env\([A-Z0-9_]+\)/gu, "");
  for (const rule of rules) {
    if (rule.pattern.test(content)) findings.push(`${file}: ${rule.label}`);
  }
}

if (findings.length) {
  console.error(`Potential secrets found:\n${findings.join("\n")}`);
  process.exit(1);
}

console.log(`Secret scan passed (${repositoryFiles.length} repository files).`);
