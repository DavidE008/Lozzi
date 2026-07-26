import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import {
  summarizeSubmissionStatus,
  validateReviewBinding,
  validateSubmissionStatus,
} from "./m7-submission-status.mjs";

const root = path.resolve(import.meta.dirname, "../../..");
const statusPath = "deployment/milestone-7/submission-status.json";

const usage = `Usage:
  pnpm submission:status
  pnpm submission:check

The status command validates and reports the tracked evidence without external
calls. The check command additionally exits non-zero until every required
submission gate passes. Neither command can deploy, sign, fund, provision,
submit, or broadcast.`;

const arguments_ = process.argv.slice(2);
if (arguments_.includes("--help")) {
  console.log(usage);
  process.exit(0);
}
for (const argument of arguments_) {
  if (
    !["--require-ready"].includes(argument) ||
    /^--(?:deploy|sign|send|submit|broadcast|fund|provision)$/u.test(argument)
  ) {
    throw new Error(`Unsupported argument: ${argument}`);
  }
}

const status = JSON.parse(
  await readFile(path.resolve(root, statusPath), "utf8"),
);
const errors = validateSubmissionStatus(status);

for (const evidencePath of status.evidencePaths ?? []) {
  try {
    await access(path.resolve(root, evidencePath));
  } catch {
    errors.push(`$.evidencePaths: missing ${evidencePath}`);
  }
}

let changedSinceReview = [];
if (/^[0-9a-f]{40}$/u.test(status.basisCommit ?? "")) {
  try {
    execFileSync(
      "git",
      ["merge-base", "--is-ancestor", status.basisCommit, "HEAD"],
      {
        cwd: root,
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
  } catch {
    errors.push("$.basisCommit: must be an ancestor of the checked-out commit");
  }

  changedSinceReview = execFileSync(
    "git",
    ["diff", "--name-only", `${status.basisCommit}..HEAD`],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  )
    .split(/\r?\n/u)
    .filter(Boolean);
}

const worktreeStatus = execFileSync(
  "git",
  ["status", "--porcelain=v1", "--untracked-files=all"],
  {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  },
).trim();
errors.push(
  ...validateReviewBinding({
    changedPaths: changedSinceReview,
    reviewedAt: status.reviewedAt,
    statusPath,
    worktreeStatus,
  }),
);

const trackedFiles = execFileSync("git", ["ls-files"], {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
})
  .split(/\r?\n/u)
  .filter(Boolean);
const forbiddenTrackedFiles = trackedFiles.filter((file) => {
  const generatedOrSecretPath =
    /(?:^|\/)(?:\.secrets|\.vercel|broadcast|cache|out|test-results|playwright-report|supabase\/\.temp)(?:\/|$)|\.(?:key|pem|keystore\.json|password)$/iu.test(
      file,
    );
  const environmentFile =
    /(?:^|\/)\.env(?:\.|$)/iu.test(file) &&
    !/(?:^|\/)\.env\.example$/iu.test(file);
  return generatedOrSecretPath || environmentFile;
});
if (forbiddenTrackedFiles.length > 0) {
  errors.push(
    `tracked generated or secret-bearing paths are forbidden: ${forbiddenTrackedFiles.join(", ")}`,
  );
}

const summary = summarizeSubmissionStatus(status);
summary.validationErrors = [
  ...new Set([...summary.validationErrors, ...errors]),
];
if (summary.validationErrors.length > 0) {
  summary.readyForDeployment = false;
  summary.readyForSubmission = false;
}

console.log(JSON.stringify(summary, null, 2));

if (summary.validationErrors.length > 0) {
  process.exitCode = 1;
} else if (
  arguments_.includes("--require-ready") &&
  !summary.readyForSubmission
) {
  process.exitCode = 1;
}
