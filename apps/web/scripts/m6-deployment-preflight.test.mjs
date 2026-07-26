import assert from "node:assert/strict";
import test from "node:test";

import {
  validateDeploymentPreparation,
  validateSimulationReport,
} from "./m6-deployment-manifest.mjs";

const address = (value) => `0x${value.repeat(40)}`;
const hash = (value) => `0x${value.repeat(64)}`;
const commit = "1".repeat(40);

const completePacket = () => {
  const safe = address("1");
  const institutionRegistry = address("2");
  const academicRegistry = address("3");
  const creationOne = hash("a");
  const creationTwo = hash("b");

  return {
    chain: {
      schemaVersion: "lozzi.m6.chain-config.v1",
      approvalStatus: "approved",
      name: "Approved test chain",
      chainId: 48_001,
      nativeCurrency: "TEST",
      primaryRpcUrl: "https://primary.example/rpc",
      independentRpcUrl: "https://independent.example/rpc",
      blockExplorerUrl: "https://explorer.example",
      minimumConfirmations: 5,
    },
    fingerprints: {
      schemaVersion: "lozzi.m6.bytecode-fingerprints.v1",
      sourceCommit: commit,
      contracts: [
        {
          name: "InstitutionRegistry",
          creationBytecodeKeccak256: creationOne,
        },
        {
          name: "AcademicRecordRegistry",
          creationBytecodeKeccak256: creationTwo,
        },
      ],
    },
    manifest: {
      schemaVersion: "lozzi.m6.deployment.v1",
      approvalStatus: "approved",
      pinnedSourceCommit: commit,
      chainConfigPath: "deployment/milestone-6/chain-config.template.json",
      bytecodeFingerprintPath:
        "deployment/milestone-6/bytecode-fingerprints.json",
      simulationReportPath:
        "deployment/milestone-6/simulation-report.template.json",
      compiler: {
        solcVersion: "0.8.30",
        evmVersion: "cancun",
        optimizerEnabled: true,
        optimizerRuns: 200,
      },
      contracts: [
        {
          name: "InstitutionRegistry",
          source: "packages/contracts/src/InstitutionRegistry.sol",
          expectedAddress: institutionRegistry,
          creationBytecodeKeccak256: creationOne,
          expectedRuntimeBytecodeKeccak256: hash("c"),
          constructorArguments: [
            {
              name: "protocolAdministrator",
              type: "address",
              value: safe,
            },
          ],
        },
        {
          name: "AcademicRecordRegistry",
          source: "packages/contracts/src/AcademicRecordRegistry.sol",
          expectedAddress: academicRegistry,
          creationBytecodeKeccak256: creationTwo,
          expectedRuntimeBytecodeKeccak256: hash("d"),
          constructorArguments: [
            {
              name: "registry",
              type: "address",
              value: institutionRegistry,
            },
          ],
        },
      ],
      governance: {
        safeAddress: safe,
        safeOwners: [address("4"), address("5"), address("6")],
        safeThreshold: 2,
        deployerAddress: address("7"),
        institutionAdministrator: safe,
        institutionSigner: address("8"),
        emergencyOwner: safe,
      },
      relayer: {
        address: address("9"),
        provider: "approved-managed-relayer",
        allowedChainId: 48_001,
        allowedContract: academicRegistry,
        allowedMethods: [
          "createShareGrant",
          "publishRecordVersion",
          "revokeShareGrant",
        ],
        maxValueWei: "0",
        maxGasPerTransaction: 800_000,
        dailyFundingCeilingWei: "10000000000000000",
      },
      funding: {
        deploymentFundingCeilingWei: "100000000000000000",
        maximumBatchGas: 5_000_000,
        maximumFeePerGasWei: "20000000000",
        maximumPriorityFeePerGasWei: "2000000000",
        maximumTotalCostWei: "100000000000000000",
      },
      transactionBatch: {
        batchId: "M6-TEST-001",
        approvalRequired: true,
        transactions: [
          {
            sequence: 1,
            action: "deploy InstitutionRegistry",
            target: null,
            valueWei: "0",
            calldataKeccak256: hash("f"),
            gasLimit: 1_200_000,
            approvalId: "M6-TEST-001-TX-01",
          },
        ],
      },
      approval: {
        status: "approved",
        packetId: "M6-TEST-001",
        preparedBy: "preparer@example.test",
        independentReviewer: "reviewer@example.test",
        approvers: ["approver@example.test"],
        approvedAt: "2026-07-26T00:00:00Z",
        expiresAt: "2026-07-27T00:00:00Z",
      },
    },
    simulation: {
      schemaVersion: "lozzi.m6.simulation-report.v1",
      status: "passed",
      manifestCommit: commit,
      chainId: 48_001,
      forkBlockNumber: 123,
      forkBlockHash: hash("e"),
      simulator: "foundry",
      simulatorVersion: "1.7.1",
      executedAt: "2026-07-26T00:00:00Z",
      broadcast: false,
      signedTransactionCount: 0,
      transactions: [
        {
          sequence: 1,
          status: "passed",
          from: address("7"),
          to: null,
          valueWei: "0",
          gasEstimate: 1_000_000,
          gasLimit: 1_200_000,
          calldataKeccak256: hash("f"),
        },
      ],
      postSimulationReadback: "passed",
      reviewer: "reviewer@example.test",
    },
  };
};

test("accepts only a complete, approved, unsigned preparation packet", () => {
  assert.deepEqual(validateDeploymentPreparation(completePacket()), []);
});

test("rejects unresolved approvals, cross-chain configuration, and secrets", () => {
  const packet = completePacket();
  packet.chain.approvalStatus = "candidate";
  packet.manifest.approvalStatus = "unapproved";
  packet.manifest.relayer.allowedChainId = 48_002;
  packet.manifest.privateKey = "forbidden";

  const errors = validateDeploymentPreparation(packet);
  assert.ok(errors.some((error) => error.includes("approvalStatus")));
  assert.ok(errors.some((error) => error.includes("allowedChainId")));
  assert.ok(errors.some((error) => error.includes("privateKey")));
});

test("rejects signed or broadcast simulation evidence", () => {
  const report = completePacket().simulation;
  report.broadcast = true;
  report.signedTransactionCount = 1;
  report.rawTransaction = "0xdeadbeef";

  const errors = validateSimulationReport(report);
  assert.ok(errors.some((error) => error.includes("broadcast")));
  assert.ok(errors.some((error) => error.includes("signedTransactionCount")));
  assert.ok(errors.some((error) => error.includes("rawTransaction")));
});

test("rejects runtime and constructor mismatches", () => {
  const packet = completePacket();
  packet.manifest.contracts[0].expectedRuntimeBytecodeKeccak256 = null;
  packet.manifest.contracts[1].constructorArguments[0].value = address("9");

  const errors = validateDeploymentPreparation(packet);
  assert.ok(
    errors.some((error) => error.includes("expectedRuntimeBytecodeKeccak256")),
  );
  assert.ok(
    errors.some((error) =>
      error.includes("AcademicRecordRegistry.constructorArguments"),
    ),
  );
});
