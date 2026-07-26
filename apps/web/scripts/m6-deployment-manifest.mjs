const ADDRESS = /^0x[0-9a-fA-F]{40}$/u;
const BYTES32 = /^0x[0-9a-fA-F]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const DECIMAL = /^(0|[1-9][0-9]*)$/u;
const HTTPS_URL = /^https:\/\/[^/?#\s]+(?:[/?#][^\s]*)?$/u;

const EXPECTED_CONTRACTS = new Map([
  [
    "InstitutionRegistry",
    {
      constructorArguments: [
        { name: "protocolAdministrator", type: "address" },
      ],
      source: "packages/contracts/src/InstitutionRegistry.sol",
    },
  ],
  [
    "AcademicRecordRegistry",
    {
      constructorArguments: [{ name: "registry", type: "address" }],
      source: "packages/contracts/src/AcademicRecordRegistry.sol",
    },
  ],
]);

const EXPECTED_RELAYER_METHODS = [
  "createShareGrant",
  "publishRecordVersion",
  "revokeShareGrant",
];

const isObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const add = (errors, path, message) => errors.push(`${path}: ${message}`);

const checkExactKeys = (errors, path, value, keys) => {
  if (!isObject(value)) {
    add(errors, path, "must be an object");
    return false;
  }
  const expected = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) add(errors, `${path}.${key}`, "is not allowed");
  }
  for (const key of keys) {
    if (!(key in value)) add(errors, `${path}.${key}`, "is required");
  }
  return true;
};

const checkString = (errors, path, value, pattern, description) => {
  if (typeof value !== "string" || !pattern.test(value)) {
    add(errors, path, `must be ${description}`);
    return false;
  }
  return true;
};

const checkPositiveInteger = (errors, path, value) => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    add(errors, path, "must be a positive safe integer");
    return false;
  }
  return true;
};

const checkDecimal = (errors, path, value, { positive = false } = {}) => {
  if (typeof value !== "string" || !DECIMAL.test(value)) {
    add(errors, path, "must be an unsigned base-10 integer string");
    return false;
  }
  if (positive && BigInt(value) === 0n) {
    add(errors, path, "must be greater than zero");
    return false;
  }
  return true;
};

const normalizeAddress = (value) =>
  typeof value === "string" ? value.toLowerCase() : value;

const rejectSensitiveKeys = (errors, value, path = "$") => {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      rejectSensitiveKeys(errors, entry, `${path}[${index}]`),
    );
    return;
  }
  if (!isObject(value)) return;

  for (const [key, entry] of Object.entries(value)) {
    if (
      /(?:private.?key|mnemonic|seed.?phrase|raw.?transaction|signature|bearer|secret|credential)/iu.test(
        key,
      )
    ) {
      add(errors, `${path}.${key}`, "secret or signed material is forbidden");
    }
    rejectSensitiveKeys(errors, entry, `${path}.${key}`);
  }
};

export const validateChainConfig = (chain) => {
  const errors = [];
  if (
    !checkExactKeys(errors, "$.chain", chain, [
      "schemaVersion",
      "approvalStatus",
      "name",
      "chainId",
      "nativeCurrency",
      "primaryRpcUrl",
      "independentRpcUrl",
      "blockExplorerUrl",
      "minimumConfirmations",
    ])
  ) {
    return errors;
  }

  if (chain.schemaVersion !== "lozzi.m6.chain-config.v1") {
    add(errors, "$.chain.schemaVersion", "must equal lozzi.m6.chain-config.v1");
  }
  if (chain.approvalStatus !== "approved") {
    add(
      errors,
      "$.chain.approvalStatus",
      "must be approved by a later explicit chain-selection decision",
    );
  }
  if (typeof chain.name !== "string" || chain.name.trim().length < 2) {
    add(errors, "$.chain.name", "must name the exact approved chain");
  }
  checkPositiveInteger(errors, "$.chain.chainId", chain.chainId);
  if (
    typeof chain.nativeCurrency !== "string" ||
    chain.nativeCurrency.trim().length < 2
  ) {
    add(errors, "$.chain.nativeCurrency", "must name the native gas currency");
  }
  checkString(
    errors,
    "$.chain.primaryRpcUrl",
    chain.primaryRpcUrl,
    HTTPS_URL,
    "an HTTPS URL",
  );
  checkString(
    errors,
    "$.chain.independentRpcUrl",
    chain.independentRpcUrl,
    HTTPS_URL,
    "an HTTPS URL",
  );
  checkString(
    errors,
    "$.chain.blockExplorerUrl",
    chain.blockExplorerUrl,
    HTTPS_URL,
    "an HTTPS URL",
  );
  checkPositiveInteger(
    errors,
    "$.chain.minimumConfirmations",
    chain.minimumConfirmations,
  );
  if (
    typeof chain.primaryRpcUrl === "string" &&
    chain.primaryRpcUrl === chain.independentRpcUrl
  ) {
    add(
      errors,
      "$.chain.independentRpcUrl",
      "must differ from the primary RPC URL",
    );
  }
  rejectSensitiveKeys(errors, chain, "$.chain");
  return errors;
};

const validateCompiler = (errors, compiler) => {
  if (
    !checkExactKeys(errors, "$.manifest.compiler", compiler, [
      "solcVersion",
      "evmVersion",
      "optimizerEnabled",
      "optimizerRuns",
    ])
  ) {
    return;
  }
  if (compiler.solcVersion !== "0.8.30") {
    add(errors, "$.manifest.compiler.solcVersion", "must equal 0.8.30");
  }
  if (compiler.evmVersion !== "cancun") {
    add(errors, "$.manifest.compiler.evmVersion", "must equal cancun");
  }
  if (compiler.optimizerEnabled !== true) {
    add(errors, "$.manifest.compiler.optimizerEnabled", "must be true");
  }
  if (compiler.optimizerRuns !== 200) {
    add(errors, "$.manifest.compiler.optimizerRuns", "must equal 200");
  }
};

const validateContracts = (errors, contracts) => {
  if (!Array.isArray(contracts)) {
    add(errors, "$.manifest.contracts", "must be an array");
    return;
  }
  if (contracts.length !== EXPECTED_CONTRACTS.size) {
    add(
      errors,
      "$.manifest.contracts",
      "must contain exactly InstitutionRegistry and AcademicRecordRegistry",
    );
  }

  const names = new Set();
  for (const [index, contract] of contracts.entries()) {
    const path = `$.manifest.contracts[${index}]`;
    if (
      !checkExactKeys(errors, path, contract, [
        "name",
        "source",
        "expectedAddress",
        "creationBytecodeKeccak256",
        "expectedRuntimeBytecodeKeccak256",
        "constructorArguments",
      ])
    ) {
      continue;
    }

    const specification = EXPECTED_CONTRACTS.get(contract.name);
    if (!specification) {
      add(errors, `${path}.name`, "is not in the approved Milestone 6 set");
      continue;
    }
    if (names.has(contract.name)) {
      add(errors, `${path}.name`, "must not be duplicated");
    }
    names.add(contract.name);
    if (contract.source !== specification.source) {
      add(errors, `${path}.source`, `must equal ${specification.source}`);
    }
    checkString(
      errors,
      `${path}.expectedAddress`,
      contract.expectedAddress,
      ADDRESS,
      "an Ethereum address",
    );
    checkString(
      errors,
      `${path}.creationBytecodeKeccak256`,
      contract.creationBytecodeKeccak256,
      BYTES32,
      "a 32-byte Keccak-256 hash",
    );
    checkString(
      errors,
      `${path}.expectedRuntimeBytecodeKeccak256`,
      contract.expectedRuntimeBytecodeKeccak256,
      BYTES32,
      "a 32-byte Keccak-256 hash reproduced from simulated deployment",
    );

    if (
      !Array.isArray(contract.constructorArguments) ||
      contract.constructorArguments.length !==
        specification.constructorArguments.length
    ) {
      add(
        errors,
        `${path}.constructorArguments`,
        "does not match the contract constructor",
      );
      continue;
    }
    contract.constructorArguments.forEach((argument, argumentIndex) => {
      const expected = specification.constructorArguments[argumentIndex];
      const argumentPath = `${path}.constructorArguments[${argumentIndex}]`;
      if (
        !checkExactKeys(errors, argumentPath, argument, [
          "name",
          "type",
          "value",
        ])
      ) {
        return;
      }
      if (argument.name !== expected.name || argument.type !== expected.type) {
        add(
          errors,
          argumentPath,
          `must be ${expected.type} ${expected.name} in constructor order`,
        );
      }
      checkString(
        errors,
        `${argumentPath}.value`,
        argument.value,
        ADDRESS,
        "an Ethereum address",
      );
    });
  }
};

const validateGovernance = (errors, governance) => {
  if (
    !checkExactKeys(errors, "$.manifest.governance", governance, [
      "safeAddress",
      "safeOwners",
      "safeThreshold",
      "deployerAddress",
      "institutionAdministrator",
      "institutionSigner",
      "emergencyOwner",
    ])
  ) {
    return;
  }
  for (const key of [
    "safeAddress",
    "deployerAddress",
    "institutionAdministrator",
    "institutionSigner",
    "emergencyOwner",
  ]) {
    checkString(
      errors,
      `$.manifest.governance.${key}`,
      governance[key],
      ADDRESS,
      "an Ethereum address",
    );
  }
  if (
    !Array.isArray(governance.safeOwners) ||
    governance.safeOwners.length < 2
  ) {
    add(
      errors,
      "$.manifest.governance.safeOwners",
      "must include at least two independently controlled owners",
    );
  } else {
    const owners = new Set();
    governance.safeOwners.forEach((owner, index) => {
      checkString(
        errors,
        `$.manifest.governance.safeOwners[${index}]`,
        owner,
        ADDRESS,
        "an Ethereum address",
      );
      owners.add(normalizeAddress(owner));
    });
    if (owners.size !== governance.safeOwners.length) {
      add(
        errors,
        "$.manifest.governance.safeOwners",
        "must contain unique addresses",
      );
    }
  }
  checkPositiveInteger(
    errors,
    "$.manifest.governance.safeThreshold",
    governance.safeThreshold,
  );
  if (
    Array.isArray(governance.safeOwners) &&
    governance.safeThreshold > governance.safeOwners.length
  ) {
    add(
      errors,
      "$.manifest.governance.safeThreshold",
      "cannot exceed the Safe owner count",
    );
  }
};

const validateRelayer = (errors, relayer) => {
  if (
    !checkExactKeys(errors, "$.manifest.relayer", relayer, [
      "address",
      "provider",
      "allowedChainId",
      "allowedContract",
      "allowedMethods",
      "maxValueWei",
      "maxGasPerTransaction",
      "dailyFundingCeilingWei",
    ])
  ) {
    return;
  }
  checkString(
    errors,
    "$.manifest.relayer.address",
    relayer.address,
    ADDRESS,
    "an Ethereum address",
  );
  if (
    typeof relayer.provider !== "string" ||
    relayer.provider.trim().length < 2
  ) {
    add(
      errors,
      "$.manifest.relayer.provider",
      "must identify the approved managed provider",
    );
  }
  checkPositiveInteger(
    errors,
    "$.manifest.relayer.allowedChainId",
    relayer.allowedChainId,
  );
  checkString(
    errors,
    "$.manifest.relayer.allowedContract",
    relayer.allowedContract,
    ADDRESS,
    "the AcademicRecordRegistry address",
  );
  if (
    !Array.isArray(relayer.allowedMethods) ||
    [...relayer.allowedMethods].sort().join(",") !==
      EXPECTED_RELAYER_METHODS.join(",")
  ) {
    add(
      errors,
      "$.manifest.relayer.allowedMethods",
      `must equal ${EXPECTED_RELAYER_METHODS.join(", ")}`,
    );
  }
  checkDecimal(errors, "$.manifest.relayer.maxValueWei", relayer.maxValueWei);
  if (relayer.maxValueWei !== "0") {
    add(
      errors,
      "$.manifest.relayer.maxValueWei",
      "must be zero because registry writes are nonpayable",
    );
  }
  checkPositiveInteger(
    errors,
    "$.manifest.relayer.maxGasPerTransaction",
    relayer.maxGasPerTransaction,
  );
  checkDecimal(
    errors,
    "$.manifest.relayer.dailyFundingCeilingWei",
    relayer.dailyFundingCeilingWei,
    { positive: true },
  );
};

const validateFunding = (errors, funding) => {
  if (
    !checkExactKeys(errors, "$.manifest.funding", funding, [
      "deploymentFundingCeilingWei",
      "maximumBatchGas",
      "maximumFeePerGasWei",
      "maximumPriorityFeePerGasWei",
      "maximumTotalCostWei",
    ])
  ) {
    return;
  }
  for (const key of [
    "deploymentFundingCeilingWei",
    "maximumFeePerGasWei",
    "maximumPriorityFeePerGasWei",
    "maximumTotalCostWei",
  ]) {
    checkDecimal(errors, `$.manifest.funding.${key}`, funding[key], {
      positive: true,
    });
  }
  checkPositiveInteger(
    errors,
    "$.manifest.funding.maximumBatchGas",
    funding.maximumBatchGas,
  );
  if (
    typeof funding.maximumFeePerGasWei === "string" &&
    typeof funding.maximumPriorityFeePerGasWei === "string" &&
    DECIMAL.test(funding.maximumFeePerGasWei) &&
    DECIMAL.test(funding.maximumPriorityFeePerGasWei) &&
    BigInt(funding.maximumPriorityFeePerGasWei) >
      BigInt(funding.maximumFeePerGasWei)
  ) {
    add(
      errors,
      "$.manifest.funding.maximumPriorityFeePerGasWei",
      "cannot exceed maximumFeePerGasWei",
    );
  }
};

const validateApproval = (errors, approval) => {
  if (
    !checkExactKeys(errors, "$.manifest.approval", approval, [
      "status",
      "packetId",
      "preparedBy",
      "independentReviewer",
      "approvers",
      "approvedAt",
      "expiresAt",
    ])
  ) {
    return;
  }
  if (approval.status !== "approved") {
    add(
      errors,
      "$.manifest.approval.status",
      "must be approved for this exact transaction batch",
    );
  }
  for (const key of [
    "packetId",
    "preparedBy",
    "independentReviewer",
    "approvedAt",
    "expiresAt",
  ]) {
    if (typeof approval[key] !== "string" || approval[key].trim() === "") {
      add(errors, `$.manifest.approval.${key}`, "must be recorded");
    }
  }
  if (
    typeof approval.preparedBy === "string" &&
    approval.preparedBy === approval.independentReviewer
  ) {
    add(
      errors,
      "$.manifest.approval.independentReviewer",
      "must differ from the preparer",
    );
  }
  if (!Array.isArray(approval.approvers) || approval.approvers.length === 0) {
    add(
      errors,
      "$.manifest.approval.approvers",
      "must record at least one explicit human approver",
    );
  }
};

export const validateDeploymentManifest = (manifest) => {
  const errors = [];
  if (
    !checkExactKeys(errors, "$.manifest", manifest, [
      "schemaVersion",
      "approvalStatus",
      "pinnedSourceCommit",
      "chainConfigPath",
      "bytecodeFingerprintPath",
      "simulationReportPath",
      "compiler",
      "contracts",
      "governance",
      "relayer",
      "funding",
      "transactionBatch",
      "approval",
    ])
  ) {
    return errors;
  }

  if (manifest.schemaVersion !== "lozzi.m6.deployment.v1") {
    add(
      errors,
      "$.manifest.schemaVersion",
      "must equal lozzi.m6.deployment.v1",
    );
  }
  if (manifest.approvalStatus !== "approved") {
    add(
      errors,
      "$.manifest.approvalStatus",
      "must remain unapproved until the later deployment gate is granted",
    );
  }
  checkString(
    errors,
    "$.manifest.pinnedSourceCommit",
    manifest.pinnedSourceCommit,
    COMMIT,
    "a full lowercase Git commit",
  );
  for (const [key, expected] of [
    ["chainConfigPath", "deployment/milestone-6/chain-config.template.json"],
    [
      "bytecodeFingerprintPath",
      "deployment/milestone-6/bytecode-fingerprints.json",
    ],
    [
      "simulationReportPath",
      "deployment/milestone-6/simulation-report.template.json",
    ],
  ]) {
    if (manifest[key] !== expected) {
      add(errors, `$.manifest.${key}`, `must equal ${expected}`);
    }
  }
  validateCompiler(errors, manifest.compiler);
  validateContracts(errors, manifest.contracts);
  validateGovernance(errors, manifest.governance);
  validateRelayer(errors, manifest.relayer);
  validateFunding(errors, manifest.funding);

  if (
    !checkExactKeys(
      errors,
      "$.manifest.transactionBatch",
      manifest.transactionBatch,
      ["batchId", "approvalRequired", "transactions"],
    )
  ) {
    // The structural errors above are enough.
  } else {
    if (
      typeof manifest.transactionBatch.batchId !== "string" ||
      manifest.transactionBatch.batchId.trim() === ""
    ) {
      add(
        errors,
        "$.manifest.transactionBatch.batchId",
        "must identify this exact ordered batch",
      );
    }
    if (manifest.transactionBatch.approvalRequired !== true) {
      add(
        errors,
        "$.manifest.transactionBatch.approvalRequired",
        "must be true",
      );
    }
    if (
      !Array.isArray(manifest.transactionBatch.transactions) ||
      manifest.transactionBatch.transactions.length === 0
    ) {
      add(
        errors,
        "$.manifest.transactionBatch.transactions",
        "must enumerate every transaction in execution order",
      );
    } else {
      manifest.transactionBatch.transactions.forEach((transaction, index) => {
        const path = `$.manifest.transactionBatch.transactions[${index}]`;
        if (
          !checkExactKeys(errors, path, transaction, [
            "sequence",
            "action",
            "target",
            "valueWei",
            "calldataKeccak256",
            "gasLimit",
            "approvalId",
          ])
        ) {
          return;
        }
        if (transaction.sequence !== index + 1) {
          add(
            errors,
            `${path}.sequence`,
            "must match the ordered batch position",
          );
        }
        if (
          typeof transaction.action !== "string" ||
          transaction.action.trim() === ""
        ) {
          add(errors, `${path}.action`, "must describe the decoded action");
        }
        if (
          transaction.target !== null &&
          !ADDRESS.test(transaction.target ?? "")
        ) {
          add(
            errors,
            `${path}.target`,
            "must be null for creation or an Ethereum address",
          );
        }
        checkDecimal(errors, `${path}.valueWei`, transaction.valueWei);
        checkString(
          errors,
          `${path}.calldataKeccak256`,
          transaction.calldataKeccak256,
          BYTES32,
          "a 32-byte Keccak-256 hash",
        );
        checkPositiveInteger(errors, `${path}.gasLimit`, transaction.gasLimit);
        if (
          typeof transaction.approvalId !== "string" ||
          transaction.approvalId.trim() === ""
        ) {
          add(
            errors,
            `${path}.approvalId`,
            "must identify transaction-specific human approval",
          );
        }
      });
    }
  }
  validateApproval(errors, manifest.approval);
  rejectSensitiveKeys(errors, manifest, "$.manifest");
  return errors;
};

export const validateSimulationReport = (report) => {
  const errors = [];
  if (
    !checkExactKeys(errors, "$.simulation", report, [
      "schemaVersion",
      "status",
      "manifestCommit",
      "chainId",
      "forkBlockNumber",
      "forkBlockHash",
      "simulator",
      "simulatorVersion",
      "executedAt",
      "broadcast",
      "signedTransactionCount",
      "transactions",
      "postSimulationReadback",
      "reviewer",
    ])
  ) {
    return errors;
  }
  if (report.schemaVersion !== "lozzi.m6.simulation-report.v1") {
    add(
      errors,
      "$.simulation.schemaVersion",
      "must equal lozzi.m6.simulation-report.v1",
    );
  }
  if (report.status !== "passed") {
    add(errors, "$.simulation.status", "must equal passed");
  }
  checkString(
    errors,
    "$.simulation.manifestCommit",
    report.manifestCommit,
    COMMIT,
    "a full lowercase Git commit",
  );
  checkPositiveInteger(errors, "$.simulation.chainId", report.chainId);
  checkPositiveInteger(
    errors,
    "$.simulation.forkBlockNumber",
    report.forkBlockNumber,
  );
  checkString(
    errors,
    "$.simulation.forkBlockHash",
    report.forkBlockHash,
    BYTES32,
    "a 32-byte block hash",
  );
  if (report.broadcast !== false) {
    add(errors, "$.simulation.broadcast", "must be false");
  }
  if (report.signedTransactionCount !== 0) {
    add(errors, "$.simulation.signedTransactionCount", "must be zero");
  }
  if (!Array.isArray(report.transactions) || report.transactions.length === 0) {
    add(
      errors,
      "$.simulation.transactions",
      "must contain every simulated transaction",
    );
  } else {
    report.transactions.forEach((transaction, index) => {
      const path = `$.simulation.transactions[${index}]`;
      if (!isObject(transaction)) {
        add(errors, path, "must be an object");
        return;
      }
      if (transaction.status !== "passed") {
        add(errors, `${path}.status`, "must equal passed");
      }
      checkPositiveInteger(errors, `${path}.sequence`, transaction.sequence);
      checkString(
        errors,
        `${path}.from`,
        transaction.from,
        ADDRESS,
        "an Ethereum address",
      );
      if (transaction.to !== null && !ADDRESS.test(transaction.to ?? "")) {
        add(
          errors,
          `${path}.to`,
          "must be null for creation or an Ethereum address",
        );
      }
      checkDecimal(errors, `${path}.valueWei`, transaction.valueWei);
      checkPositiveInteger(
        errors,
        `${path}.gasEstimate`,
        transaction.gasEstimate,
      );
      checkPositiveInteger(errors, `${path}.gasLimit`, transaction.gasLimit);
      checkString(
        errors,
        `${path}.calldataKeccak256`,
        transaction.calldataKeccak256,
        BYTES32,
        "a 32-byte Keccak-256 hash",
      );
      if (
        Number.isSafeInteger(transaction.gasEstimate) &&
        Number.isSafeInteger(transaction.gasLimit) &&
        transaction.gasEstimate > transaction.gasLimit
      ) {
        add(errors, `${path}.gasLimit`, "must cover the simulated estimate");
      }
    });
  }
  if (report.postSimulationReadback !== "passed") {
    add(errors, "$.simulation.postSimulationReadback", "must equal passed");
  }
  if (typeof report.reviewer !== "string" || report.reviewer.trim() === "") {
    add(errors, "$.simulation.reviewer", "must identify the reviewer");
  }
  rejectSensitiveKeys(errors, report, "$.simulation");
  return errors;
};

export const validateDeploymentPreparation = ({
  manifest,
  chain,
  simulation,
  fingerprints,
}) => {
  const errors = [
    ...validateChainConfig(chain),
    ...validateDeploymentManifest(manifest),
    ...validateSimulationReport(simulation),
  ];

  if (
    isObject(manifest) &&
    isObject(chain) &&
    manifest.relayer?.allowedChainId !== chain.chainId
  ) {
    add(
      errors,
      "$.manifest.relayer.allowedChainId",
      "must equal the approved chain ID",
    );
  }
  if (
    isObject(manifest) &&
    isObject(chain) &&
    isObject(simulation) &&
    simulation.chainId !== chain.chainId
  ) {
    add(errors, "$.simulation.chainId", "must equal the approved chain ID");
  }
  if (
    isObject(manifest) &&
    isObject(simulation) &&
    simulation.manifestCommit !== manifest.pinnedSourceCommit
  ) {
    add(
      errors,
      "$.simulation.manifestCommit",
      "must equal the manifest pinned source commit",
    );
  }

  if (
    !isObject(fingerprints) ||
    fingerprints.schemaVersion !== "lozzi.m6.bytecode-fingerprints.v1"
  ) {
    add(
      errors,
      "$.fingerprints.schemaVersion",
      "must equal lozzi.m6.bytecode-fingerprints.v1",
    );
  } else if (isObject(manifest)) {
    if (fingerprints.sourceCommit !== manifest.pinnedSourceCommit) {
      add(
        errors,
        "$.fingerprints.sourceCommit",
        "must equal the manifest pinned source commit",
      );
    }
    const byName = new Map(
      Array.isArray(fingerprints.contracts)
        ? fingerprints.contracts.map((contract) => [contract.name, contract])
        : [],
    );
    for (const contract of manifest.contracts ?? []) {
      const fingerprint = byName.get(contract.name);
      if (!fingerprint) {
        add(errors, "$.fingerprints.contracts", `is missing ${contract.name}`);
      } else if (
        fingerprint.creationBytecodeKeccak256 !==
        contract.creationBytecodeKeccak256
      ) {
        add(
          errors,
          `$.manifest.contracts.${contract.name}.creationBytecodeKeccak256`,
          "does not match the reproducible build fingerprint",
        );
      }
    }
  }

  const institutionRegistry = manifest?.contracts?.find(
    (contract) => contract.name === "InstitutionRegistry",
  );
  const academicRegistry = manifest?.contracts?.find(
    (contract) => contract.name === "AcademicRecordRegistry",
  );
  if (
    institutionRegistry &&
    manifest?.governance &&
    normalizeAddress(institutionRegistry.constructorArguments?.[0]?.value) !==
      normalizeAddress(manifest.governance.safeAddress)
  ) {
    add(
      errors,
      "$.manifest.contracts.InstitutionRegistry.constructorArguments",
      "protocol administrator must be the approved Safe",
    );
  }
  if (
    institutionRegistry &&
    academicRegistry &&
    normalizeAddress(academicRegistry.constructorArguments?.[0]?.value) !==
      normalizeAddress(institutionRegistry.expectedAddress)
  ) {
    add(
      errors,
      "$.manifest.contracts.AcademicRecordRegistry.constructorArguments",
      "registry must equal the expected InstitutionRegistry address",
    );
  }
  if (
    academicRegistry &&
    manifest?.relayer &&
    normalizeAddress(manifest.relayer.allowedContract) !==
      normalizeAddress(academicRegistry.expectedAddress)
  ) {
    add(
      errors,
      "$.manifest.relayer.allowedContract",
      "must equal the expected AcademicRecordRegistry address",
    );
  }

  const preparedTransactions = manifest?.transactionBatch?.transactions;
  const simulatedTransactions = simulation?.transactions;
  if (
    Array.isArray(preparedTransactions) &&
    Array.isArray(simulatedTransactions) &&
    preparedTransactions.length !== simulatedTransactions.length
  ) {
    add(
      errors,
      "$.simulation.transactions",
      "must cover every transaction in the ordered approval batch",
    );
  } else if (
    Array.isArray(preparedTransactions) &&
    Array.isArray(simulatedTransactions)
  ) {
    preparedTransactions.forEach((prepared, index) => {
      const simulated = simulatedTransactions[index];
      if (
        simulated &&
        (prepared.sequence !== simulated.sequence ||
          prepared.calldataKeccak256 !== simulated.calldataKeccak256 ||
          prepared.valueWei !== simulated.valueWei ||
          prepared.gasLimit !== simulated.gasLimit ||
          normalizeAddress(prepared.target) !== normalizeAddress(simulated.to))
      ) {
        add(
          errors,
          `$.simulation.transactions[${index}]`,
          "must exactly match the prepared transaction sequence, target, value, calldata hash, and gas limit",
        );
      }
    });
  }

  return [...new Set(errors)];
};
