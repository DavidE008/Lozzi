import {
  PROGRESS_EXPLANATION_DISCLAIMER,
  type ProgressExplanationInput,
} from "@lozzi/domain";
import { describe, expect, it, vi } from "vitest";

import { PartnerIntegrationError } from "./errors";
import { runProgressExplanationWorkflow } from "./progress-explanation";

const audit: ProgressExplanationInput = {
  creditsEarned: 3,
  creditsRequired: 120,
  currentGpa: 4,
  programName: "Bachelor of Science in Computer Science",
  programVersion: "1",
  requirements: [
    { code: "CS 1301", credits: 3, status: "complete" },
    { code: "CS 2305", credits: 3, status: "in-progress" },
  ],
};

const explanation = {
  disclaimer: PROGRESS_EXPLANATION_DISCLAIMER,
  possibleNextCourses: [
    {
      courseCode: "CS 2402",
      reason: "It may follow the current course sequence.",
      requiresAdvisorReview: true,
    },
  ],
  progressHighlights: ["CS 1301 is complete."],
  risks: ["CS 2305 is still in progress."],
  summary: "You have completed 3 of 120 required credits.",
};

const bytes32 = (digit: string) =>
  `0x${digit.repeat(64)}` as `0x${string}`;

const makeDependencies = () => {
  let uploadCount = 0;
  let idCount = 0;
  const completeRun = vi.fn().mockResolvedValue(undefined);
  const recordObject = vi
    .fn()
    .mockResolvedValueOnce("00000000-0000-4000-8000-000000000101")
    .mockResolvedValueOnce("00000000-0000-4000-8000-000000000102");
  return {
    completeRun,
    compute: {
      explainProgress: vi.fn().mockResolvedValue({
        ...explanation,
        providerRequestId: "router-request-1",
      }),
    },
    keyWrappingMasterKey: Buffer.alloc(32, 7).toString("base64"),
    model: "test-model",
    newId: () =>
      `00000000-0000-4000-8000-${String(++idCount).padStart(12, "0")}`,
    newSalt: () => bytes32("f"),
    recordObject,
    startRun: vi
      .fn()
      .mockResolvedValue("00000000-0000-4000-8000-000000000201"),
    storage: {
      putEncryptedObject: vi.fn().mockImplementation(async ({ ciphertext }) => {
        uploadCount += 1;
        expect(Buffer.from(ciphertext).toString("utf8")).not.toContain(
          audit.programName,
        );
        expect(Buffer.from(ciphertext).toString("utf8")).not.toContain(
          "CS 1301",
        );
        return {
          objectReference: `0g://${bytes32(String(uploadCount))}`,
          rootHash: bytes32(String(uploadCount)),
          transactionHash: bytes32(String(uploadCount + 2)),
        };
      }),
    },
  };
};

describe("progress explanation workflow", () => {
  it("stores encrypted input and output with durable audit evidence", async () => {
    const dependencies = makeDependencies();
    const result = await runProgressExplanationWorkflow(
      {
        audit,
        institutionId: "00000000-0000-4000-8000-000000000001",
        studentId: "00000000-0000-4000-8000-000000000002",
      },
      dependencies,
    );

    expect(result.explanation).toEqual(explanation);
    expect(result.evidence).toEqual({
      inputRootHash: bytes32("1"),
      outputRootHash: bytes32("2"),
      providerRequestId: "router-request-1",
      runId: "00000000-0000-4000-8000-000000000201",
    });
    expect(dependencies.recordObject).toHaveBeenCalledTimes(2);
    expect(dependencies.recordObject.mock.calls[0]![0].metadata.objectType).toBe(
      "degree-audit-context",
    );
    expect(dependencies.recordObject.mock.calls[1]![0].metadata.objectType).toBe(
      "progress-explanation",
    );
    expect(dependencies.completeRun).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCategory: null,
        validationStatus: "valid",
      }),
    );
  });

  it("records a categorized failed run without fabricating output", async () => {
    const dependencies = makeDependencies();
    dependencies.compute.explainProgress.mockRejectedValueOnce(
      new PartnerIntegrationError(
        "rate-limited",
        "The provider is temporarily busy.",
      ),
    );

    await expect(
      runProgressExplanationWorkflow(
        {
          audit,
          institutionId: "00000000-0000-4000-8000-000000000001",
          studentId: "00000000-0000-4000-8000-000000000002",
        },
        dependencies,
      ),
    ).rejects.toMatchObject({ category: "rate-limited" });
    expect(dependencies.recordObject).toHaveBeenCalledTimes(1);
    expect(dependencies.completeRun).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCategory: "rate-limited",
        outputObjectId: null,
        validationStatus: "failed",
      }),
    );
  });
});
