import "server-only";

import {
  isGeneratedEnsAlias,
  type IntegrationFailureCategory,
} from "@lozzi/domain";
import {
  getAddress,
  keccak256,
  namehash,
  stringToHex,
  type Hash,
  type Hex,
} from "viem";

import { getEnsConfig } from "./config";
import {
  buildEnsSubname,
  createEnsNameProvider,
  type EnsConfirmation,
  type EnsSubmission,
  verifyEnsForwardResolutionCleared,
} from "./ens";
import {
  beginEnsIssuanceSubmission,
  finalizeEnsRevocation,
  finalizeEnsIssuance,
  listPendingEnsRevocations,
  listReconcilableEnsOperations,
  markEnsIssuanceSubmitted,
  reserveEnsIssuance,
  type EnsIssuanceOperation,
  type EnsOperationStatus,
} from "./ens-records";
import { classifyPartnerError, PartnerIntegrationError } from "./errors";

interface EnsIssuanceProvider {
  confirmSubname(input: {
    readonly name: string;
    readonly requestKey: Hex;
    readonly transactionHash: Hash;
    readonly walletAddress: `0x${string}`;
  }): Promise<EnsConfirmation>;
  findSubmission(input: {
    readonly requestKey: Hex;
    readonly walletAddress: `0x${string}`;
  }): Promise<Hash | null>;
  submitSubname(input: {
    readonly label: string;
    readonly requestKey: Hex;
    readonly walletAddress: `0x${string}`;
  }): Promise<EnsSubmission>;
}

export interface EnsIssuanceOutcome {
  readonly name: string;
  readonly operationId: string;
  readonly status: EnsOperationStatus;
  readonly transactionHash: `0x${string}` | null;
}

const requireOperationIdentity = (operation: {
  readonly name: string | null;
  readonly requestId: string | null;
  readonly requestKey: `0x${string}` | null;
}) => {
  if (!operation.name || !operation.requestId || !operation.requestKey) {
    throw new PartnerIntegrationError(
      "integrity",
      "The ENS operation is missing its durable request identity.",
    );
  }
  return {
    name: operation.name,
    requestId: operation.requestId,
    requestKey: operation.requestKey,
  };
};

const confirmationOutcome = async (input: {
  readonly name: string;
  readonly operationId: string;
  readonly provider: EnsIssuanceProvider;
  readonly requestId: string;
  readonly requestKey: Hex;
  readonly transactionHash: Hash;
  readonly walletAddress: `0x${string}`;
}): Promise<EnsIssuanceOutcome> => {
  const confirmation = await input.provider.confirmSubname({
    name: input.name,
    requestKey: input.requestKey,
    transactionHash: input.transactionHash,
    walletAddress: input.walletAddress,
  });
  const finalized = await finalizeEnsIssuance({
    ...confirmation,
    operationId: input.operationId,
    requestId: input.requestId,
    transactionHash: input.transactionHash,
  });
  return {
    name: input.name,
    operationId: input.operationId,
    status: finalized.status,
    transactionHash: input.transactionHash,
  };
};

export const createEnsRequestKey = (requestId: string): Hex =>
  keccak256(stringToHex(requestId));

export const issueEnsAlias = async (
  input: {
    readonly consentedAt: string;
    readonly label: string;
    readonly requestId: string;
    readonly studentId: string;
    readonly studentWalletId: string;
    readonly walletAddress: `0x${string}`;
  },
  provider: EnsIssuanceProvider = createEnsNameProvider(),
): Promise<EnsIssuanceOutcome> => {
  if (!isGeneratedEnsAlias(input.label)) {
    throw new PartnerIntegrationError(
      "invalid-request",
      "Choose one of the generated public aliases before continuing.",
    );
  }

  const config = getEnsConfig();
  const name = buildEnsSubname(input.label, config.parentName);
  const requestKey = createEnsRequestKey(input.requestId);
  const reservation = await reserveEnsIssuance({
    adapterAddress: getAddress(config.registrarAddress),
    consentedAt: input.consentedAt,
    labelHash: keccak256(stringToHex(input.label)),
    name,
    nameHash: namehash(name),
    parentName: config.parentName,
    requestId: input.requestId,
    requestKey,
    studentId: input.studentId,
    studentWalletId: input.studentWalletId,
    walletAddress: getAddress(input.walletAddress),
  });

  if (reservation.status === "active" || reservation.status === "revocation-pending") {
    if (!reservation.name) {
      throw new PartnerIntegrationError(
        "integrity",
        "The existing ENS identity is missing its public name.",
      );
    }
    return {
      name: reservation.name,
      operationId: reservation.operationId,
      status: reservation.status,
      transactionHash: reservation.transactionHash,
    };
  }

  const identity = requireOperationIdentity(reservation);
  const submissionState = await beginEnsIssuanceSubmission(
    reservation.operationId,
    identity.requestId,
  );
  let transactionHash = submissionState.transactionHash;

  if (submissionState.status === "submitting" && !transactionHash) {
    transactionHash = await provider.findSubmission({
      requestKey: identity.requestKey,
      walletAddress: input.walletAddress,
    });
    if (!transactionHash && submissionState.submissionAuthorized) {
      const submitted = await provider.submitSubname({
        label: input.label,
        requestKey: identity.requestKey,
        walletAddress: input.walletAddress,
      });
      if (submitted.name !== identity.name) {
        throw new PartnerIntegrationError(
          "integrity",
          "The ENS signer returned a name outside the reserved parent.",
        );
      }
      transactionHash = submitted.transactionHash;
    }
    if (transactionHash) {
      await markEnsIssuanceSubmitted({
        operationId: reservation.operationId,
        requestId: identity.requestId,
        submittedAt: new Date().toISOString(),
        transactionHash,
      });
    }
  }

  if (!transactionHash) {
    return {
      name: identity.name,
      operationId: reservation.operationId,
      status: "submitting",
      transactionHash: null,
    };
  }

  try {
    return await confirmationOutcome({
      name: identity.name,
      operationId: reservation.operationId,
      provider,
      requestId: identity.requestId,
      requestKey: identity.requestKey,
      transactionHash,
      walletAddress: input.walletAddress,
    });
  } catch (error) {
    const category = classifyPartnerError(error).category;
    const transientCategories: readonly IntegrationFailureCategory[] = [
      "network",
      "provider-unavailable",
      "rate-limited",
      "timeout",
    ];
    if (!transientCategories.includes(category)) throw error;
    return {
      name: identity.name,
      operationId: reservation.operationId,
      status: "submitted",
      transactionHash,
    };
  }
};

export interface EnsReconciliationResult {
  readonly category?: IntegrationFailureCategory;
  readonly operationId: string;
  readonly status: EnsOperationStatus | "error";
  readonly transactionHash: `0x${string}` | null;
}

export const reconcileEnsOperation = async (
  operation: EnsIssuanceOperation,
  provider: EnsIssuanceProvider = createEnsNameProvider(),
): Promise<EnsIssuanceOutcome> => {
  const config = getEnsConfig();
  if (getAddress(operation.adapterAddress) !== getAddress(config.registrarAddress)) {
    throw new PartnerIntegrationError(
      "integrity",
      "The stored ENS operation targets a different registrar deployment.",
    );
  }

  let transactionHash = operation.transactionHash;
  if (!transactionHash && operation.status === "submitting") {
    transactionHash = await provider.findSubmission({
      requestKey: operation.requestKey,
      walletAddress: operation.resolvedAddress,
    });
    if (!transactionHash) {
      return {
        name: operation.name,
        operationId: operation.operationId,
        status: operation.status,
        transactionHash: null,
      };
    }
    await markEnsIssuanceSubmitted({
      operationId: operation.operationId,
      requestId: operation.requestId,
      submittedAt: new Date().toISOString(),
      transactionHash,
    });
  }
  if (!transactionHash) {
    throw new PartnerIntegrationError(
      "integrity",
      "The ENS operation has no transaction to confirm.",
    );
  }
  return confirmationOutcome({
    name: operation.name,
    operationId: operation.operationId,
    provider,
    requestId: operation.requestId,
    requestKey: operation.requestKey,
    transactionHash,
    walletAddress: operation.resolvedAddress,
  });
};

export const reconcileEnsOperations = async (
  limit = 10,
): Promise<readonly EnsReconciliationResult[]> => {
  const [operations, revocations] = await Promise.all([
    listReconcilableEnsOperations(limit),
    listPendingEnsRevocations(limit),
  ]);
  const provider = createEnsNameProvider();
  const results: EnsReconciliationResult[] = [];
  for (const operation of operations) {
    try {
      const outcome = await reconcileEnsOperation(operation, provider);
      results.push({
        operationId: outcome.operationId,
        status: outcome.status,
        transactionHash: outcome.transactionHash,
      });
    } catch (error) {
      results.push({
        category: classifyPartnerError(error).category,
        operationId: operation.operationId,
        status: "error",
        transactionHash: operation.transactionHash,
      });
    }
  }
  for (const revocation of revocations) {
    try {
      const cleared = await verifyEnsForwardResolutionCleared(revocation.name);
      if (!cleared) {
        results.push({
          operationId: revocation.operationId,
          status: "revocation-pending",
          transactionHash: null,
        });
        continue;
      }
      await finalizeEnsRevocation(
        revocation.operationId,
        new Date().toISOString(),
      );
      results.push({
        operationId: revocation.operationId,
        status: "revoked",
        transactionHash: null,
      });
    } catch (error) {
      results.push({
        category: classifyPartnerError(error).category,
        operationId: revocation.operationId,
        status: "error",
        transactionHash: null,
      });
    }
  }
  return results;
};
