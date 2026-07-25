import { randomBytes, randomUUID } from "node:crypto";

import {
  createCommitment,
  progressExplanationInputSchema,
  progressExplanationSchema,
  type IntegrationFailureCategory,
  type PrivateStorageProvider,
  type ProgressExplanation,
  type ProgressExplanationInput,
} from "@lozzi/domain";

import { getZeroGComputeConfig, getZeroGStorageConfig } from "./config";
import { classifyPartnerError } from "./errors";
import {
  completeAiProgressRun,
  recordZeroGObject,
  startAiProgressRun,
} from "./partner-records";
import { encryptPrivateJson } from "./private-envelope";
import {
  createZeroGComputeProvider,
  type ZeroGProgressExplanation,
} from "./zero-g-compute";
import { createZeroGStorageProvider } from "./zero-g-storage";

const VERIFICATION_MODE = "router-schema-validation-v1";

interface ProgressWorkflowDependencies {
  readonly completeRun: typeof completeAiProgressRun;
  readonly compute: {
    explainProgress(
      input: ProgressExplanationInput,
    ): Promise<ZeroGProgressExplanation>;
  };
  readonly keyWrappingMasterKey: string;
  readonly model: string;
  readonly newId: () => string;
  readonly newSalt: () => `0x${string}`;
  readonly recordObject: typeof recordZeroGObject;
  readonly startRun: typeof startAiProgressRun;
  readonly storage: Pick<PrivateStorageProvider, "putEncryptedObject">;
}

export interface ProgressExplanationWorkflowInput {
  readonly audit: ProgressExplanationInput;
  readonly institutionId: string;
  readonly studentId: string;
}

export interface ProgressExplanationWorkflowResult {
  readonly evidence: {
    readonly inputRootHash: `0x${string}`;
    readonly outputRootHash: `0x${string}`;
    readonly providerRequestId: string | null;
    readonly runId: string;
  };
  readonly explanation: ProgressExplanation;
}

const freshSalt = (): `0x${string}` =>
  `0x${randomBytes(32).toString("hex")}`;

const createDependencies = (): ProgressWorkflowDependencies => {
  const storageConfig = getZeroGStorageConfig();
  const computeConfig = getZeroGComputeConfig();
  return {
    completeRun: completeAiProgressRun,
    compute: createZeroGComputeProvider(),
    keyWrappingMasterKey: storageConfig.keyWrappingMasterKey,
    model: computeConfig.model,
    newId: randomUUID,
    newSalt: freshSalt,
    recordObject: recordZeroGObject,
    startRun: startAiProgressRun,
    storage: createZeroGStorageProvider(),
  };
};

const inputPayload = (audit: ProgressExplanationInput) => ({
  creditsEarned: audit.creditsEarned,
  creditsRequired: audit.creditsRequired,
  currentGpa: audit.currentGpa,
  programName: audit.programName,
  programVersion: audit.programVersion,
  requirements: audit.requirements.map((requirement) => ({
    code: requirement.code,
    credits: requirement.credits,
    status: requirement.status,
  })),
});

const explanationPayload = (explanation: ProgressExplanation) => ({
  disclaimer: explanation.disclaimer,
  possibleNextCourses: explanation.possibleNextCourses.map((course) => ({
    courseCode: course.courseCode,
    reason: course.reason,
    requiresAdvisorReview: course.requiresAdvisorReview,
  })),
  progressHighlights: explanation.progressHighlights,
  risks: explanation.risks,
  summary: explanation.summary,
});

export const runProgressExplanationWorkflow = async (
  input: ProgressExplanationWorkflowInput,
  dependencies: ProgressWorkflowDependencies = createDependencies(),
): Promise<ProgressExplanationWorkflowResult> => {
  const audit = progressExplanationInputSchema.parse(input.audit);
  const requestPayload = inputPayload(audit);
  const encryptedInput = encryptPrivateJson(requestPayload, {
    institutionId: input.institutionId,
    keyWrappingMasterKey: dependencies.keyWrappingMasterKey,
    objectType: "degree-audit-context",
    ownerId: input.studentId,
  });
  const inputUpload = await dependencies.storage.putEncryptedObject({
    ciphertext: encryptedInput.bytes,
    ciphertextSha256: encryptedInput.ciphertextSha256,
    metadata: encryptedInput.metadata,
    wrappingKeyReference: encryptedInput.metadata.wrappingKeyReference,
  });
  const inputObjectId = await dependencies.recordObject({
    idempotencyKey: dependencies.newId(),
    metadata: encryptedInput.metadata,
    objectReference: inputUpload.objectReference,
    rootHash: inputUpload.rootHash,
    sizeBytes: encryptedInput.bytes.byteLength,
    studentId: input.studentId,
    transactionHash: inputUpload.transactionHash,
  });
  const requestCommitment = createCommitment({
    domain: "ai-request",
    institutionId: input.institutionId,
    payload: requestPayload,
    salt: dependencies.newSalt(),
  });
  const runId = await dependencies.startRun({
    idempotencyKey: dependencies.newId(),
    inputObjectId,
    model: dependencies.model,
    requestCommitment,
    studentId: input.studentId,
    verificationMode: VERIFICATION_MODE,
  });

  try {
    const computeResult = await dependencies.compute.explainProgress(audit);
    const { providerRequestId, ...candidateExplanation } = computeResult;
    const explanation =
      progressExplanationSchema.parse(candidateExplanation);
    const responsePayload = explanationPayload(explanation);
    const encryptedOutput = encryptPrivateJson(responsePayload, {
      institutionId: input.institutionId,
      keyWrappingMasterKey: dependencies.keyWrappingMasterKey,
      objectType: "progress-explanation",
      ownerId: input.studentId,
    });
    const outputUpload = await dependencies.storage.putEncryptedObject({
      ciphertext: encryptedOutput.bytes,
      ciphertextSha256: encryptedOutput.ciphertextSha256,
      metadata: encryptedOutput.metadata,
      wrappingKeyReference: encryptedOutput.metadata.wrappingKeyReference,
    });
    const outputObjectId = await dependencies.recordObject({
      idempotencyKey: dependencies.newId(),
      metadata: encryptedOutput.metadata,
      objectReference: outputUpload.objectReference,
      rootHash: outputUpload.rootHash,
      sizeBytes: encryptedOutput.bytes.byteLength,
      studentId: input.studentId,
      transactionHash: outputUpload.transactionHash,
    });
    const responseCommitment = createCommitment({
      domain: "ai-response",
      institutionId: input.institutionId,
      payload: responsePayload,
      salt: dependencies.newSalt(),
    });
    await dependencies.completeRun({
      errorCategory: null,
      outputObjectId,
      providerRequestId: providerRequestId ?? null,
      responseCommitment,
      runId,
      validationStatus: "valid",
    });

    return {
      evidence: {
        inputRootHash: inputUpload.rootHash,
        outputRootHash: outputUpload.rootHash,
        providerRequestId: providerRequestId ?? null,
        runId,
      },
      explanation,
    };
  } catch (error) {
    const classified = classifyPartnerError(error);
    await dependencies
      .completeRun({
        errorCategory: classified.category,
        outputObjectId: null,
        providerRequestId: null,
        responseCommitment: null,
        runId,
        validationStatus:
          classified.category === "invalid-response" ? "invalid" : "failed",
      })
      .catch(() => undefined);
    throw classified;
  }
};

export const progressFailureCategory = (
  error: unknown,
): IntegrationFailureCategory => classifyPartnerError(error).category;
