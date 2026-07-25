import {
  parseEnvironment,
  PROGRESS_EXPLANATION_DISCLAIMER,
  type ProgressExplanation,
  type ProgressExplanationInput,
} from "@lozzi/domain";
import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth";
import { classifyPartnerError } from "@/lib/integrations/errors";
import { recordCapabilityState } from "@/lib/integrations/partner-records";
import { runProgressExplanationWorkflow } from "@/lib/integrations/progress-explanation";
import { logEvent } from "@/lib/logging";
import { getInstitutionAccessForUser } from "@/lib/repositories/access";
import {
  getStudentDegreeProgress,
  type StudentDegreeProgress,
} from "@/lib/repositories/grades";
import { getDashboardForUser } from "@/lib/repositories/student";
import { assertSameOrigin } from "@/lib/security/origin";

const toExplanationInput = (
  progress: StudentDegreeProgress,
): ProgressExplanationInput => ({
  creditsEarned: progress.credits_earned,
  creditsRequired: progress.credits_required,
  currentGpa: progress.gpa,
  programName: progress.program_name,
  programVersion: String(progress.program_version),
  requirements: progress.requirement_results.map((requirement) => ({
    code: requirement.code,
    credits: requirement.credits ?? null,
    status: requirement.status,
  })),
});

const createDevelopmentMock = (
  input: ProgressExplanationInput,
): ProgressExplanation => ({
  disclaimer: PROGRESS_EXPLANATION_DISCLAIMER,
  possibleNextCourses: [],
  progressHighlights: input.requirements
    .filter(({ status }) => status === "complete")
    .slice(0, 3)
    .map(({ code }) => `${code} is marked complete in the current audit.`),
  risks: input.requirements
    .filter(({ status }) => status !== "complete")
    .slice(0, 3)
    .map(
      ({ code, status }) =>
        `${code} is currently marked ${status.replace("-", " ")}.`,
    ),
  summary: `This development mock summarizes ${input.creditsEarned} of ${input.creditsRequired} required credits for ${input.programName}. It did not call 0G.`,
});

export async function POST(): Promise<Response> {
  let institutionId: string | null = null;
  try {
    await assertSameOrigin();
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }
    const [dashboard, access] = await Promise.all([
      getDashboardForUser(user.id),
      getInstitutionAccessForUser(user.id),
    ]);
    if (!dashboard || !access) {
      return NextResponse.json(
        { error: "Student profile required." },
        { status: 403 },
      );
    }
    institutionId = access.institutionId;
    const progress = await getStudentDegreeProgress(dashboard.studentId);
    if (!progress) {
      return NextResponse.json(
        { error: "A current degree audit is required." },
        { status: 409 },
      );
    }

    const audit = toExplanationInput(progress);
    const zeroGCapability = parseEnvironment(process.env).capabilities.find(
      ({ name }) => name === "zero-g",
    )!;
    if (zeroGCapability.status === "mock-development") {
      return NextResponse.json(
        {
          explanation: createDevelopmentMock(audit),
          mode: "mock-development",
        },
        { headers: { "cache-control": "no-store" } },
      );
    }
    if (zeroGCapability.status !== "available") {
      return NextResponse.json(
        { error: "0G private compute is not configured." },
        { status: 503 },
      );
    }

    const result = await runProgressExplanationWorkflow({
      audit,
      institutionId,
      studentId: dashboard.studentId,
    });
    await recordCapabilityState({
      detail:
        "Encrypted degree-audit input and explanation were verified on 0G Storage.",
      errorCategory: null,
      evidenceReference: `0g://${result.evidence.outputRootHash}`,
      institutionId,
      provider: "zero-g",
      state: "available",
    });

    return NextResponse.json(
      {
        evidence: result.evidence,
        explanation: result.explanation,
        mode: "available",
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const classified = classifyPartnerError(error);
    logEvent("warn", "zero_g_progress_explanation_failed", {
      category: classified.category,
    });
    if (institutionId) {
      await recordCapabilityState({
        detail: "The most recent private progress explanation attempt failed.",
        errorCategory: classified.category,
        evidenceReference: null,
        institutionId,
        provider: "zero-g",
        state: "failed",
      }).catch(() => undefined);
    }
    const status =
      classified.category === "rate-limited"
        ? 429
        : classified.category === "configuration" ||
            classified.category === "provider-unavailable" ||
            classified.category === "network" ||
            classified.category === "timeout"
          ? 503
          : 400;
    return NextResponse.json({ error: classified.publicMessage }, { status });
  }
}
