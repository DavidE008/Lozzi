import {
  canonicalizeJson,
  progressExplanationInputSchema,
  progressExplanationSchema,
  PROGRESS_EXPLANATION_DISCLAIMER,
  type ComputeProvider,
  type ProgressExplanation,
  type ProgressExplanationInput,
} from "@lozzi/domain";
import { z } from "zod";

import { getZeroGComputeConfig } from "./config";
import { PartnerIntegrationError } from "./errors";

const routerResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().min(1) }),
      }),
    )
    .min(1),
  id: z.string().optional(),
});

export interface ZeroGProgressExplanation extends ProgressExplanation {
  readonly providerRequestId?: string;
}

const endpoint = (routerUrl: string) =>
  new URL(
    "chat/completions",
    routerUrl.endsWith("/") ? routerUrl : `${routerUrl}/`,
  ).toString();

export class ZeroGComputeProvider implements ComputeProvider {
  readonly capability = {
    name: "zero-g" as const,
    status: "available" as const,
    label: "0G Compute Router",
    detail: "Server-side 0G Compute Router is configured.",
  };

  async explainProgress(
    input: ProgressExplanationInput,
  ): Promise<ZeroGProgressExplanation> {
    const config = getZeroGComputeConfig();
    const validatedInput = progressExplanationInputSchema.parse(input);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let response: Response;
    try {
      response = await fetch(endpoint(config.routerUrl), {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: "system",
              content: [
                "Explain a student's deterministic degree audit in plain language.",
                "Do not invent requirements, grades, eligibility, or institutional policy.",
                "Use only the supplied requirement rows.",
                "Return one JSON object with summary, progressHighlights, possibleNextCourses, risks, and disclaimer.",
                `The disclaimer must be exactly: ${PROGRESS_EXPLANATION_DISCLAIMER}`,
              ].join(" "),
            },
            {
              role: "user",
              content: canonicalizeJson(validatedInput),
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0,
        }),
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const category =
        response.status === 401 || response.status === 403
          ? "authentication"
          : response.status === 429
            ? "rate-limited"
            : response.status >= 500
              ? "provider-unavailable"
              : "invalid-response";
      throw new PartnerIntegrationError(
        category,
        "0G Compute could not produce a progress explanation.",
      );
    }

    const routerResult = routerResponseSchema.safeParse(await response.json());
    if (!routerResult.success) {
      throw new PartnerIntegrationError(
        "invalid-response",
        "0G Compute returned an invalid response.",
      );
    }
    let explanation: unknown;
    try {
      explanation = JSON.parse(routerResult.data.choices[0]!.message.content);
    } catch (error) {
      throw new PartnerIntegrationError(
        "invalid-response",
        "0G Compute returned non-JSON output.",
        { cause: error },
      );
    }

    const validatedExplanation =
      progressExplanationSchema.safeParse(explanation);
    if (!validatedExplanation.success) {
      throw new PartnerIntegrationError(
        "invalid-response",
        "0G Compute returned an explanation that failed schema validation.",
        { cause: validatedExplanation.error },
      );
    }

    return {
      ...validatedExplanation.data,
      providerRequestId: routerResult.data.id,
    };
  }
}

export const createZeroGComputeProvider = () => new ZeroGComputeProvider();
