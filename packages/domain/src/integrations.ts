import type { CapabilityState } from "./capabilities";
import type {
  EnsResolution,
  PrivateObjectMetadata,
  ProgressExplanation,
  ProgressExplanationInput,
  WorldPurpose,
  WorldRpContext,
  WorldVerificationSignal,
} from "./partners";

export interface WorldVerificationRequest {
  readonly action: string;
  readonly allowLegacyProofs: boolean;
  readonly appId: string;
  readonly environment: "production" | "sandbox" | "staging";
  readonly preset:
    | { readonly type: "proof-of-human" }
    | { readonly type: "selfie-check-legacy" }
    | {
        readonly attributes: readonly [
          { readonly type: "minimum_age"; readonly value: 18 },
        ];
        readonly type: "identity-check";
      };
  readonly purpose: WorldPurpose;
  readonly requireUserPresence: boolean;
  readonly rpContext: WorldRpContext;
  readonly signal?: `0x${string}`;
  readonly subjectId?: string;
}

export interface VerificationProvider {
  readonly capability: CapabilityState;
  createRequest(input: {
    readonly authenticatedUserId: string;
    readonly purpose: WorldPurpose;
    readonly subjectId?: string;
  }): Promise<WorldVerificationRequest>;
  verify(input: {
    readonly authenticatedUserId: string;
    readonly challengeId?: string;
    readonly expectedEnvironment: "production" | "sandbox" | "staging";
    readonly expectedNonce: string;
    readonly purpose: WorldPurpose;
    readonly rawBody: string;
    readonly subjectId?: string;
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
