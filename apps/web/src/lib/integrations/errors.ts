import type { IntegrationFailureCategory } from "@lozzi/domain";

export class PartnerIntegrationError extends Error {
  constructor(
    readonly category: IntegrationFailureCategory,
    readonly publicMessage: string,
    options?: ErrorOptions,
  ) {
    super(publicMessage, options);
    this.name = "PartnerIntegrationError";
  }
}

export const classifyPartnerError = (
  error: unknown,
): PartnerIntegrationError => {
  if (error instanceof PartnerIntegrationError) return error;
  if (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  ) {
    return new PartnerIntegrationError(
      "timeout",
      "The partner service did not respond in time.",
      { cause: error },
    );
  }
  return new PartnerIntegrationError(
    "unknown",
    "The partner operation could not be completed.",
    { cause: error },
  );
};
