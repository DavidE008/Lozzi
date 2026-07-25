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
