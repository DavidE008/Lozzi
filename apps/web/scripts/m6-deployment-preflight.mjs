import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { validateDeploymentPreparation } from "./m6-deployment-manifest.mjs";

const root = path.resolve(import.meta.dirname, "../../..");
const defaults = {
  chain: "deployment/milestone-6/chain-config.template.json",
  fingerprints: "deployment/milestone-6/bytecode-fingerprints.json",
  manifest: "deployment/milestone-6/manifest.template.json",
  simulation: "deployment/milestone-6/simulation-report.template.json",
};

const usage = `Usage:
  pnpm deployment:preflight [--manifest PATH] [--chain PATH] [--simulation PATH]

This command is offline and read-only. It validates an already prepared,
unsigned simulation packet. It cannot sign, send, or broadcast transactions.`;

const parseArguments = (arguments_) => {
  const options = { ...defaults };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--help") {
      console.log(usage);
      process.exit(0);
    }
    if (/^--(?:broadcast|sign|send|private-key)$/u.test(argument)) {
      throw new Error(
        `${argument} is intentionally unsupported. This tool is offline and read-only.`,
      );
    }
    if (!["--manifest", "--chain", "--simulation"].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = arguments_[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a path`);
    }
    options[argument.slice(2)] = value;
    index += 1;
  }
  return options;
};

const readJson = async (relativePath) =>
  JSON.parse(await readFile(path.resolve(root, relativePath), "utf8"));

const git = (...arguments_) =>
  execFileSync("git", arguments_, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const [manifest, chain, simulation, fingerprints] = await Promise.all([
    readJson(options.manifest),
    readJson(options.chain),
    readJson(options.simulation),
    readJson(defaults.fingerprints),
  ]);

  const errors = validateDeploymentPreparation({
    chain,
    fingerprints,
    manifest,
    simulation,
  });

  if (/^[0-9a-f]{40}$/u.test(manifest.pinnedSourceCommit ?? "")) {
    try {
      git("merge-base", "--is-ancestor", manifest.pinnedSourceCommit, "HEAD");
    } catch {
      errors.push(
        "$.manifest.pinnedSourceCommit: must be an ancestor of the checked-out commit",
      );
    }
    const changedContracts = git(
      "diff",
      "--name-only",
      `${manifest.pinnedSourceCommit}..HEAD`,
      "--",
      "packages/contracts/src",
      "packages/contracts/foundry.toml",
      "packages/contracts/package.json",
      "pnpm-lock.yaml",
    );
    if (changedContracts) {
      errors.push(
        `$.manifest.pinnedSourceCommit: contract build inputs changed after the pin (${changedContracts.replaceAll("\n", ", ")})`,
      );
    }
  }

  if (errors.length > 0) {
    console.error("Milestone 6 deployment preparation is NOT ready:");
    for (const error of [...new Set(errors)]) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    JSON.stringify(
      {
        broadcast: false,
        chainId: chain.chainId,
        contractCount: manifest.contracts.length,
        manifestCommit: manifest.pinnedSourceCommit,
        readyForTransactionSpecificHumanApproval: true,
        signedTransactionCount: 0,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(
    `Milestone 6 deployment preflight failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
});
