import "server-only";

import type { OutboxEventType } from "@lozzi/domain";
import { z } from "zod";

import { classifyPartnerError, PartnerIntegrationError } from "@/lib/integrations/errors";
import {
  createWorldChainRegistryAdapter,
  type PreparedRegistryTransaction,
  type RegistryCommand,
} from "@/lib/integrations/registry-adapter";
import { createServiceClient } from "@/lib/supabase/service";

import type {
  OutboxWorkerHandler,
  OutboxWorkerHandlers,
  OutboxWorkerOutcome,
} from "./types";

const databaseBytes32Schema = z
  .string()
  .regex(/^\\x[0-9a-fA-F]{64}$/u)
  .transform((value) => `0x${value.slice(2).toLowerCase()}` as const);

export interface AcademicRecordCommitmentResolver {
  resolve(input: {
    academicRecordVersionId: string;
    institutionId: string;
  }): Promise<`0x${string}`>;
}

export interface RegistrySimulationAdapter {
  prepare(command: RegistryCommand): Promise<PreparedRegistryTransaction>;
}

class SupabaseAcademicRecordCommitmentResolver
  implements AcademicRecordCommitmentResolver
{
  async resolve(input: {
    academicRecordVersionId: string;
    institutionId: string;
  }): Promise<`0x${string}`> {
    const client = createServiceClient();
    const { data, error } = await client
      .from("academic_record_versions")
      .select("content_commitment")
      .eq("id", input.academicRecordVersionId)
      .eq("institution_id", input.institutionId)
      .maybeSingle();
    if (error || !data) {
      throw new PartnerIntegrationError(
        "integrity",
        "The immutable academic record commitment could not be resolved.",
      );
    }
    const parsed = databaseBytes32Schema.safeParse(data.content_commitment);
    if (!parsed.success) {
      throw new PartnerIntegrationError(
        "integrity",
        "The immutable academic record commitment is malformed.",
      );
    }
    return parsed.data;
  }
}

const classifyRegistryFailure = (error: unknown): OutboxWorkerOutcome => {
  const classified = classifyPartnerError(error);
  switch (classified.category) {
    case "configuration":
      return {
        classification: "configuration_blocked",
        errorCode: "registry_not_configured",
      };
    case "invalid-response":
      return {
        classification: "simulation_rejected",
        errorCode: "registry_simulation_rejected",
        receiptState: "simulation_rejected",
      };
    case "authorization":
      return {
        classification: "non_retryable",
        errorCode: "registry_authorization_failed",
      };
    case "integrity":
    case "invalid-request":
    case "replay":
      return {
        classification: "non_retryable",
        errorCode: "registry_integrity_check_failed",
      };
    case "network":
    case "provider-unavailable":
    case "rate-limited":
    case "timeout":
      return {
        classification: "retryable",
        errorCode: "registry_temporarily_unavailable",
      };
    default:
      return {
        classification: "retryable",
        errorCode: "registry_unknown_failure",
      };
  }
};

const asValidatedHex = (value: string): `0x${string}` =>
  value as `0x${string}`;

const simulationHandler = (
  eventType: OutboxEventType,
  getAdapter: () => RegistrySimulationAdapter,
  resolver: AcademicRecordCommitmentResolver,
): OutboxWorkerHandler => {
  return async (claim) => {
    if (claim.phase !== "submission" || claim.event.eventType !== eventType) {
      return {
        classification: "non_retryable",
        errorCode: "invalid_worker_phase",
      };
    }

    try {
      const event = claim.event;
      if (event.eventType === "academic_record.anchor.requested.v1") {
        await getAdapter().prepare({
          idempotencyKey: event.idempotencyKey,
          institutionCommitment: asValidatedHex(
            event.payload.institutionCommitment,
          ),
          kind: "anchor-record",
          recordVersionCommitment: asValidatedHex(
            event.payload.recordCommitment,
          ),
          studentCommitment: asValidatedHex(event.payload.studentCommitment),
        });
      } else if (event.eventType === "share_grant.create.requested.v1") {
        const recordVersionCommitment = await resolver.resolve({
          academicRecordVersionId: event.payload.academicRecordVersionId,
          institutionId: event.institutionId,
        });
        await getAdapter().prepare({
          expiresAt: event.payload.expiresAt,
          grantCommitment: asValidatedHex(event.payload.grantCommitment),
          idempotencyKey: event.idempotencyKey,
          institutionCommitment: asValidatedHex(
            event.payload.institutionCommitment,
          ),
          kind: "create-share",
          recordVersionCommitment,
          studentCommitment: asValidatedHex(event.payload.studentCommitment),
        });
      } else {
        await getAdapter().prepare({
          grantCommitment: asValidatedHex(event.payload.grantCommitment),
          idempotencyKey: event.idempotencyKey,
          institutionCommitment: asValidatedHex(
            event.payload.institutionCommitment,
          ),
          kind: "revoke-share",
        });
      }
      return {
        classification: "simulation_succeeded",
        receiptState: "simulation_succeeded",
      };
    } catch (error) {
      return classifyRegistryFailure(error);
    }
  };
};

export const createRegistrySubmissionHandlers = (input?: {
  adapter?: RegistrySimulationAdapter;
  resolver?: AcademicRecordCommitmentResolver;
}): OutboxWorkerHandlers => {
  const getAdapter = input?.adapter
    ? () => input.adapter!
    : createWorldChainRegistryAdapter;
  const resolver =
    input?.resolver ?? new SupabaseAcademicRecordCommitmentResolver();

  return {
    "academic_record.anchor.requested.v1": simulationHandler(
      "academic_record.anchor.requested.v1",
      getAdapter,
      resolver,
    ),
    "share_grant.create.requested.v1": simulationHandler(
      "share_grant.create.requested.v1",
      getAdapter,
      resolver,
    ),
    "share_grant.revoke.requested.v1": simulationHandler(
      "share_grant.revoke.requested.v1",
      getAdapter,
      resolver,
    ),
  };
};
