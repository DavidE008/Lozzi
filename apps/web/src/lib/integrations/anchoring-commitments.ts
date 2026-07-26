import "server-only";

import {
  createInstitutionCommitment,
  createStudentCommitment,
  INSTITUTION_COMMITMENT_ALGORITHM,
  STUDENT_COMMITMENT_ALGORITHM,
} from "@lozzi/domain";
import { createHmac } from "node:crypto";
import { z } from "zod";

const anchoringCommitmentConfigSchema = z.object({
  ANCHORING_COMMITMENT_ENVIRONMENT: z.enum([
    "development",
    "test",
    "staging",
    "production",
  ]),
  ANCHORING_COMMITMENT_KEY_VERSION: z.coerce
    .number()
    .int()
    .min(1)
    .max(2_147_483_647),
  ANCHORING_INSTITUTION_ROOT_SECRET: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/u),
  ANCHORING_STUDENT_ROOT_SECRET: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/u),
});

type AnchoringCommitmentSource = Readonly<
  Record<string, string | undefined>
>;

const deriveInstitutionScopedSecret = (
  rootSecret: string,
  purpose: "institution" | "student",
  environment: string,
  keyVersion: number,
  institutionId: string,
): `0x${string}` => {
  const rootBytes = Buffer.from(rootSecret.slice(2), "hex");
  const context = [
    "LOZZI_ANCHORING_SCOPED_SECRET_V1",
    purpose,
    environment,
    String(keyVersion),
    institutionId,
  ].join("\u0000");
  return `0x${createHmac("sha256", rootBytes).update(context).digest("hex")}`;
};

export const createAnchoringCommitmentIdentity = (
  input: {
    readonly institutionId: string;
    readonly studentOpaqueId: string;
  },
  source: AnchoringCommitmentSource = process.env,
) => {
  const config = anchoringCommitmentConfigSchema.parse(source);
  const institutionSecret = deriveInstitutionScopedSecret(
    config.ANCHORING_INSTITUTION_ROOT_SECRET,
    "institution",
    config.ANCHORING_COMMITMENT_ENVIRONMENT,
    config.ANCHORING_COMMITMENT_KEY_VERSION,
    input.institutionId,
  );
  const studentSecret = deriveInstitutionScopedSecret(
    config.ANCHORING_STUDENT_ROOT_SECRET,
    "student",
    config.ANCHORING_COMMITMENT_ENVIRONMENT,
    config.ANCHORING_COMMITMENT_KEY_VERSION,
    input.institutionId,
  );
  const institutionCommitment = createInstitutionCommitment({
    environment: config.ANCHORING_COMMITMENT_ENVIRONMENT,
    institutionId: input.institutionId,
    keyVersion: config.ANCHORING_COMMITMENT_KEY_VERSION,
    secret: institutionSecret,
  });

  return {
    commitmentEnvironment: config.ANCHORING_COMMITMENT_ENVIRONMENT,
    institutionCommitment,
    institutionCommitmentAlgorithm: INSTITUTION_COMMITMENT_ALGORITHM,
    institutionCommitmentKeyVersion:
      config.ANCHORING_COMMITMENT_KEY_VERSION,
    studentCommitment: createStudentCommitment({
      environment: config.ANCHORING_COMMITMENT_ENVIRONMENT,
      institutionCommitment,
      institutionScopedSecret: studentSecret,
      keyVersion: config.ANCHORING_COMMITMENT_KEY_VERSION,
      studentOpaqueId: input.studentOpaqueId,
    }),
    studentCommitmentAlgorithm: STUDENT_COMMITMENT_ALGORITHM,
    studentCommitmentKeyVersion: config.ANCHORING_COMMITMENT_KEY_VERSION,
  } as const;
};
