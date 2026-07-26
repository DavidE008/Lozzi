import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { keccak256, toHex } from "viem";

const root = path.resolve(import.meta.dirname, "../../..");
const fingerprintPath = path.join(
  root,
  "deployment/milestone-6/bytecode-fingerprints.json",
);
const contracts = [
  {
    artifact:
      "packages/contracts/out/InstitutionRegistry.sol/InstitutionRegistry.json",
    name: "InstitutionRegistry",
    source: "packages/contracts/src/InstitutionRegistry.sol",
  },
  {
    artifact:
      "packages/contracts/out/AcademicRecordRegistry.sol/AcademicRecordRegistry.json",
    name: "AcademicRecordRegistry",
    source: "packages/contracts/src/AcademicRecordRegistry.sol",
  },
  {
    artifact:
      "packages/contracts/out/InstitutionalEnsRegistrar.sol/InstitutionalEnsRegistrar.json",
    name: "InstitutionalEnsRegistrar",
    source: "packages/contracts/src/InstitutionalEnsRegistrar.sol",
  },
];

const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();

const fingerprintContracts = await Promise.all(
  contracts.map(async (contract) => {
    const [artifact, source] = await Promise.all([
      readFile(path.join(root, contract.artifact), "utf8").then(JSON.parse),
      readFile(path.join(root, contract.source), "utf8"),
    ]);
    const immutableReferences =
      artifact.deployedBytecode.immutableReferences ?? {};
    const immutableReferenceCount = Object.values(immutableReferences).reduce(
      (total, references) => total + references.length,
      0,
    );
    return {
      name: contract.name,
      source: contract.source,
      sourceKeccak256: keccak256(toHex(source)),
      creationBytecodeKeccak256: keccak256(artifact.bytecode.object),
      runtimeTemplateKeccak256: keccak256(artifact.deployedBytecode.object),
      immutableReferenceCount,
      runtimeHashRequiresConstructorArguments: immutableReferenceCount > 0,
    };
  }),
);

const output = {
  schemaVersion: "lozzi.m6.bytecode-fingerprints.v1",
  sourceCommit,
  compiler: {
    solcVersion: "0.8.30",
    evmVersion: "cancun",
    optimizerEnabled: true,
    optimizerRuns: 200,
  },
  contracts: fingerprintContracts,
};

if (process.argv.includes("--check")) {
  const expected = JSON.parse(await readFile(fingerprintPath, "utf8"));
  const comparableOutput = { ...output, sourceCommit: expected.sourceCommit };
  if (JSON.stringify(comparableOutput) !== JSON.stringify(expected)) {
    console.error(
      "Bytecode fingerprints do not match the tracked reproducible build record.",
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Bytecode fingerprints match (${fingerprintContracts.length} contracts).`,
    );
  }
} else {
  console.log(JSON.stringify(output, null, 2));
}
