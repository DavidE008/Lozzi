import { z } from "zod";

export type GradeLifecycleState =
  "draft" | "submitted" | "approved" | "published";

export type GradeCorrectionReason =
  | "clerical_error"
  | "calculation_error"
  | "incomplete_resolved"
  | "appeal_outcome"
  | "other_documented";

export interface GradeComponents {
  readonly participationScore: number | null;
  readonly assignmentAverage: number | null;
  readonly finalExamScore: number | null;
}

export interface GradeCalculation {
  readonly complete: boolean;
  readonly totalScore: number | null;
  readonly gradeCode: string | null;
  readonly gradePoints: number | null;
  readonly missingFields: readonly (
    "participationScore" | "assignmentAverage" | "finalExamScore"
  )[];
}

const nullableScore = (maximum: number) =>
  z.number().min(0).max(maximum).nullable();

export const gradeComponentsSchema = z.object({
  participationScore: nullableScore(10),
  assignmentAverage: nullableScore(100),
  finalExamScore: nullableScore(100),
});

const gradeScale = [
  { minimum: 93, code: "A", points: 4 },
  { minimum: 90, code: "A-", points: 3.7 },
  { minimum: 87, code: "B+", points: 3.3 },
  { minimum: 83, code: "B", points: 3 },
  { minimum: 80, code: "B-", points: 2.7 },
  { minimum: 77, code: "C+", points: 2.3 },
  { minimum: 73, code: "C", points: 2 },
  { minimum: 70, code: "C-", points: 1.7 },
  { minimum: 67, code: "D+", points: 1.3 },
  { minimum: 63, code: "D", points: 1 },
  { minimum: 60, code: "D-", points: 0.7 },
  { minimum: 0, code: "F", points: 0 },
] as const;

const roundTo = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export const calculateGrade = (input: GradeComponents): GradeCalculation => {
  const value = gradeComponentsSchema.parse(input);
  const missingFields = (
    ["participationScore", "assignmentAverage", "finalExamScore"] as const
  ).filter((field) => value[field] === null);

  if (missingFields.length) {
    return {
      complete: false,
      totalScore: null,
      gradeCode: null,
      gradePoints: null,
      missingFields,
    };
  }

  const totalScore = roundTo(
    (value.participationScore ?? 0) +
      (value.assignmentAverage ?? 0) * 0.4 +
      (value.finalExamScore ?? 0) * 0.5,
    2,
  );
  const grade = gradeScale.find(({ minimum }) => totalScore >= minimum);

  if (!grade) {
    throw new Error("Grade scale could not classify the calculated total.");
  }

  return {
    complete: true,
    totalScore,
    gradeCode: grade.code,
    gradePoints: grade.points,
    missingFields: [],
  };
};

export interface PublishedGrade {
  readonly courseId: string;
  readonly courseCode: string;
  readonly versionNumber: number;
  readonly gradeCode: string;
  readonly gradePoints: number;
  readonly attemptedCredits: number;
  readonly earnedCredits: number;
  readonly publishedAt: string;
  readonly current: boolean;
}

export interface ProgramRequirement {
  readonly id: string;
  readonly group: string;
  readonly courseId: string;
  readonly courseCode: string;
  readonly courseTitle: string;
  readonly credits: number;
}

export interface DegreeAuditInput {
  readonly creditsRequired: number;
  readonly requirements: readonly ProgramRequirement[];
  readonly publishedGrades: readonly PublishedGrade[];
  readonly inProgressCourseIds: readonly string[];
}

export interface DegreeAuditResult {
  readonly creditsEarned: number;
  readonly gpa: number | null;
  readonly progressPercent: number;
  readonly requirements: readonly (ProgramRequirement & {
    readonly status: "complete" | "in-progress" | "remaining";
  })[];
}

export const calculateGpa = (
  records: readonly PublishedGrade[],
): number | null => {
  const current = records.filter(
    ({ current, attemptedCredits }) => current && attemptedCredits > 0,
  );
  if (!current.length) return null;

  const attemptedCredits = current.reduce(
    (total, record) => total + record.attemptedCredits,
    0,
  );
  const qualityPoints = current.reduce(
    (total, record) => total + record.gradePoints * record.attemptedCredits,
    0,
  );

  return attemptedCredits > 0
    ? roundTo(qualityPoints / attemptedCredits, 2)
    : null;
};

export const calculateDegreeAudit = ({
  creditsRequired,
  requirements,
  publishedGrades,
  inProgressCourseIds,
}: DegreeAuditInput): DegreeAuditResult => {
  if (!Number.isFinite(creditsRequired) || creditsRequired <= 0) {
    throw new TypeError("Required credits must be greater than zero.");
  }

  const currentGrades = publishedGrades.filter(({ current }) => current);
  const completedCourseIds = new Set(
    currentGrades
      .filter(({ earnedCredits }) => earnedCredits > 0)
      .map(({ courseId }) => courseId),
  );
  const inProgress = new Set(inProgressCourseIds);
  const creditsEarned = roundTo(
    currentGrades.reduce((total, record) => total + record.earnedCredits, 0),
    2,
  );

  return {
    creditsEarned,
    gpa: calculateGpa(currentGrades),
    progressPercent: Math.min(
      roundTo((creditsEarned / creditsRequired) * 100, 2),
      100,
    ),
    requirements: [...requirements]
      .sort(
        (left, right) =>
          left.group.localeCompare(right.group) ||
          left.courseCode.localeCompare(right.courseCode),
      )
      .map((requirement) => ({
        ...requirement,
        status: completedCourseIds.has(requirement.courseId)
          ? ("complete" as const)
          : inProgress.has(requirement.courseId)
            ? ("in-progress" as const)
            : ("remaining" as const),
      })),
  };
};

export interface AcademicRecordCommitmentInput {
  readonly pseudonymousStudentId: string;
  readonly records: readonly PublishedGrade[];
}

export const buildAcademicRecordCommitmentPayload = ({
  pseudonymousStudentId,
  records,
}: AcademicRecordCommitmentInput) => ({
  schemaVersion: 1,
  student: pseudonymousStudentId,
  records: records
    .filter(({ current }) => current)
    .sort(
      (left, right) =>
        left.courseCode.localeCompare(right.courseCode) ||
        left.versionNumber - right.versionNumber,
    )
    .map((record) => ({
      attemptedCredits: record.attemptedCredits,
      courseCode: record.courseCode,
      earnedCredits: record.earnedCredits,
      gradeCode: record.gradeCode,
      gradePoints: record.gradePoints,
      publishedAt: record.publishedAt,
      version: record.versionNumber,
    })),
});

export interface GradeWorkflowRepository {
  saveDrafts(input: {
    readonly sectionId: string;
    readonly grades: readonly (GradeComponents & {
      readonly enrollmentId: string;
    })[];
    readonly idempotencyKey: string;
  }): Promise<void>;
  submitSection(input: {
    readonly sectionId: string;
    readonly idempotencyKey: string;
  }): Promise<void>;
  approve(input: {
    readonly gradeSubmissionId: string;
    readonly idempotencyKey: string;
  }): Promise<void>;
  publish(input: {
    readonly gradeSubmissionId: string;
    readonly contentCommitment: `0x${string}`;
    readonly saltReference: string;
    readonly idempotencyKey: string;
  }): Promise<void>;
  startCorrection(input: {
    readonly gradeRecordId: string;
    readonly reasonCode: GradeCorrectionReason;
    readonly idempotencyKey: string;
  }): Promise<void>;
}
