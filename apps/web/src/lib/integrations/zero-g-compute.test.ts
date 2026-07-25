import {
  PROGRESS_EXPLANATION_DISCLAIMER,
  type ProgressExplanationInput,
} from "@lozzi/domain";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ZeroGComputeProvider } from "./zero-g-compute";

const input: ProgressExplanationInput = {
  creditsEarned: 3,
  creditsRequired: 120,
  currentGpa: 4,
  programName: "Computer Science",
  programVersion: "2026",
  requirements: [
    { code: "CS 1301", credits: 3, status: "complete" },
    { code: "CS 2305", credits: 3, status: "in-progress" },
  ],
};

describe("0G Compute provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uses the server Router and validates bounded JSON output", async () => {
    vi.stubEnv("ZERO_G_ROUTER_URL", "https://router-api.0g.ai/v1");
    vi.stubEnv("ZERO_G_COMPUTE_API_KEY", "sk-synthetic");
    vi.stubEnv("ZERO_G_COMPUTE_MODEL", "synthetic/model");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "router-request-synthetic",
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: "Three credits are complete.",
                    progressHighlights: ["CS 1301 is complete."],
                    possibleNextCourses: [],
                    risks: ["Confirm registration with an advisor."],
                    disclaimer: PROGRESS_EXPLANATION_DISCLAIMER,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );

    const result = await new ZeroGComputeProvider().explainProgress(input);

    expect(result.providerRequestId).toBe("router-request-synthetic");
    expect(result.disclaimer).toBe(PROGRESS_EXPLANATION_DISCLAIMER);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://router-api.0g.ai/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer sk-synthetic",
        }),
      }),
    );
  });

  it("rejects an unstructured provider response", async () => {
    vi.stubEnv("ZERO_G_ROUTER_URL", "https://router-api.0g.ai/v1");
    vi.stubEnv("ZERO_G_COMPUTE_API_KEY", "sk-synthetic");
    vi.stubEnv("ZERO_G_COMPUTE_MODEL", "synthetic/model");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Take any course you like." } }],
        }),
        { status: 200 },
      ),
    );

    await expect(
      new ZeroGComputeProvider().explainProgress(input),
    ).rejects.toMatchObject({ category: "invalid-response" });
  });
});
