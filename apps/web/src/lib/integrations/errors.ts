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
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P0001" &&
    "message" in error &&
    error.message === "Wallet-link challenge rate limit exceeded"
  ) {
    return new PartnerIntegrationError(
      "rate-limited",
      "Too many wallet verification attempts were started. Try again later.",
      { cause: error },
    );
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  ) {
    return new PartnerIntegrationError(
      "replay",
      "A conflicting partner operation already exists.",
      { cause: error },
    );
  }
  if (
    error instanceof Error &&
    "category" in error &&
    error.category === "configuration"
  ) {
    return new PartnerIntegrationError(
      "configuration",
      "This partner capability is not configured.",
      { cause: error },
    );
  }
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
  if (error instanceof TypeError) {
    return new PartnerIntegrationError(
      "network",
      "The partner service could not be reached.",
      { cause: error },
    );
  }
  return new PartnerIntegrationError(
    "unknown",
    "The partner operation could not be completed.",
    { cause: error },
  );
};
