import type { CapabilityState } from "./capabilities";
import type {
  EnsResolution,
  PrivateObjectMetadata,
  ProgressExplanation,
  ProgressExplanationInput,
  WorldRpContext,
  WorldVerificationSignal,
} from "./partners";

export interface WorldVerificationRequest {
  readonly action: string;
  readonly appId: string;
  readonly rpContext: WorldRpContext;
  readonly signal: `0x${string}`;
}

export interface VerificationProvider {
  readonly capability: CapabilityState;
  createRequest(authenticatedUserId: string): Promise<WorldVerificationRequest>;
  verify(input: {
    readonly authenticatedUserId: string;
    readonly idkitResult: unknown;
  }): Promise<WorldVerificationSignal>;
}

export type IdentityVerificationProvider = VerificationProvider;

export interface NameProvider {
  readonly capability: CapabilityState;
  issueSubname(input: {
    readonly idempotencyKey: string;
    readonly label: string;
    readonly walletAddress: `0x${string}`;
  }): Promise<{
    readonly name: string;
    readonly transactionHash?: `0x${string}`;
  }>;
  resolveAddress(walletAddress: `0x${string}`): Promise<EnsResolution>;
}

export type NamingProvider = NameProvider;

export interface ComputeProvider {
  readonly capability: CapabilityState;
  explainProgress(
    input: ProgressExplanationInput,
  ): Promise<ProgressExplanation>;
}

export type PrivateInferenceProvider = ComputeProvider;

export interface PrivateStorageProvider {
  readonly capability: CapabilityState;
  putEncryptedObject(input: {
    readonly ciphertext: Uint8Array;
    readonly ciphertextSha256: `0x${string}`;
    readonly metadata: PrivateObjectMetadata;
    readonly wrappingKeyReference: string;
  }): Promise<{
    readonly objectReference: string;
    readonly rootHash: `0x${string}`;
    readonly transactionHash?: `0x${string}`;
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
