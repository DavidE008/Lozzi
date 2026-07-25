import type { CapabilityState } from "./capabilities";

export interface VerificationSignal {
  readonly subject: string;
  readonly verifiedAt: string;
  readonly provider: "world";
}

export interface VerificationProvider {
  readonly capability: CapabilityState;
  verify(proof: unknown): Promise<VerificationSignal>;
}

export type IdentityVerificationProvider = VerificationProvider;

export interface NameProvider {
  readonly capability: CapabilityState;
  resolveSubname(label: string): Promise<string | null>;
}

export type NamingProvider = NameProvider;

export interface ComputeProvider {
  readonly capability: CapabilityState;
  infer(input: Readonly<Record<string, unknown>>): Promise<unknown>;
}

export type PrivateInferenceProvider = ComputeProvider;

export interface PrivateStorageProvider {
  readonly capability: CapabilityState;
  putEncryptedObject(input: {
    readonly ciphertext: Uint8Array;
    readonly ciphertextSha256: `0x${string}`;
    readonly encryptionMode: "aes-256-gcm" | "ecies";
    readonly wrappingKeyReference: string;
  }): Promise<{
    readonly objectReference: string;
    readonly rootHash: `0x${string}`;
  }>;
}

export interface WalletProvider {
  readonly capability: CapabilityState;
  requestStudentAuthorization(
    payloadHash: `0x${string}`,
  ): Promise<`0x${string}`>;
}

export interface CommitmentPublisher {
  readonly capability: CapabilityState;
  publishRecord(
    commitment: `0x${string}`,
    idempotencyKey: `0x${string}`,
  ): Promise<`0x${string}`>;
}

export type BlockchainAnchorProvider = CommitmentPublisher;
