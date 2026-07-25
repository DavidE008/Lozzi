import { z } from "zod";

export const capabilityStatusSchema = z.enum([
  "available",
  "mock-development",
  "not-configured",
  "failed",
]);

export type CapabilityStatus = z.infer<typeof capabilityStatusSchema>;

export type CapabilityName =
  | "supabase"
  | "world"
  | "world-agentkit"
  | "world-chain"
  | "ens"
  | "zero-g"
  | "walletconnect";

export interface CapabilityState {
  readonly name: CapabilityName;
  readonly status: CapabilityStatus;
  readonly label: string;
  readonly detail: string;
}

export const createCapability = (
  name: CapabilityName,
  status: CapabilityStatus,
  label: string,
  detail: string,
): CapabilityState => ({ name, status, label, detail });

export interface CapabilityInputs {
  readonly configured: boolean;
  readonly detailWhenAvailable: string;
  readonly detailWhenMissing: string;
  readonly failedDetail?: string;
  readonly label: string;
  readonly mockRequested?: boolean;
  readonly name: CapabilityName;
  readonly nodeEnvironment: "development" | "test" | "production";
  readonly providerFailed?: boolean;
}

export const resolveCapability = ({
  configured,
  detailWhenAvailable,
  detailWhenMissing,
  failedDetail,
  label,
  mockRequested = false,
  name,
  nodeEnvironment,
  providerFailed = false,
}: CapabilityInputs): CapabilityState => {
  if (providerFailed && configured) {
    return createCapability(
      name,
      "failed",
      label,
      failedDetail ?? "The configured provider is unavailable.",
    );
  }
  if (configured) {
    return createCapability(name, "available", label, detailWhenAvailable);
  }
  if (mockRequested && nodeEnvironment === "development") {
    return createCapability(
      name,
      "mock-development",
      label,
      "Development mock — no live partner call.",
    );
  }
  return createCapability(name, "not-configured", label, detailWhenMissing);
};
