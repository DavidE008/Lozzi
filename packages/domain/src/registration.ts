export type RegistrationBlockingCode =
  | "STUDENT_NOT_ACTIVE"
  | "REGISTRATION_CLOSED"
  | "SECTION_CLOSED"
  | "SECTION_FULL"
  | "DUPLICATE_ENROLLMENT"
  | "COURSE_ALREADY_COMPLETED"
  | "MISSING_PREREQUISITE"
  | "MISSING_COREQUISITE"
  | "MAX_CREDIT_LOAD"
  | "MIN_CREDIT_LOAD"
  | "BLOCKING_HOLD"
  | "SCHEDULE_CONFLICT"
  | "SECTION_RESTRICTION"
  | "UNSUPPORTED_SECTION_RESTRICTION";

export type RegistrationWarningCode = "LIMITED_SEATS";

export interface RegistrationReason<
  Code extends string = RegistrationBlockingCode | RegistrationWarningCode,
> {
  readonly code: Code;
  readonly message: string;
  readonly relatedEntityId: string;
}

export interface EnrollmentEligibility {
  readonly eligible: boolean;
  readonly blockingReasons: readonly RegistrationReason<RegistrationBlockingCode>[];
  readonly warnings: readonly RegistrationReason<RegistrationWarningCode>[];
}

export interface RegistrationMeeting {
  readonly sectionId: string;
  readonly weekday: number;
  readonly startsAt: string;
  readonly endsAt: string;
}

export interface RegistrationRequirement {
  readonly courseId: string;
  readonly code: string;
  readonly title: string;
  readonly kind: "prerequisite" | "corequisite";
  readonly minimumGradePoints: number;
  readonly satisfied: boolean;
}

export interface SectionRestrictionInput {
  readonly allowedAcademicStatuses?: readonly string[];
  readonly allowedProgramCodes?: readonly string[];
  readonly unsupportedKeys?: readonly string[];
}

export interface EnrollmentEligibilityInput {
  readonly now: string;
  readonly studentId: string;
  readonly studentAcademicStatus: string;
  readonly studentProgramCode: string | null;
  readonly termId: string;
  readonly termStatus: string;
  readonly registrationOpensAt: string | null;
  readonly registrationClosesAt: string | null;
  readonly maxCredits: number;
  readonly sectionId: string;
  readonly sectionStatus: string;
  readonly capacity: number;
  readonly enrolledCount: number;
  readonly courseId: string;
  readonly courseTitle: string;
  readonly courseCredits: number;
  readonly repeatRestricted: boolean;
  readonly alreadyEnrolled: boolean;
  readonly alreadyCompleted: boolean;
  readonly currentCredits: number;
  readonly selectedCredits: number;
  readonly blockingHoldId: string | null;
  readonly requirements: readonly RegistrationRequirement[];
  readonly targetMeetings: readonly RegistrationMeeting[];
  readonly otherMeetings: readonly RegistrationMeeting[];
  readonly restrictions: SectionRestrictionInput;
}

const overlaps = (
  target: RegistrationMeeting,
  other: RegistrationMeeting,
): boolean =>
  target.weekday === other.weekday &&
  target.startsAt < other.endsAt &&
  target.endsAt > other.startsAt;

export const evaluateEnrollmentEligibility = (
  input: EnrollmentEligibilityInput,
): EnrollmentEligibility => {
  const blockingReasons: RegistrationReason<RegistrationBlockingCode>[] = [];
  const warnings: RegistrationReason<RegistrationWarningCode>[] = [];
  const now = Date.parse(input.now);
  const opensAt = input.registrationOpensAt
    ? Date.parse(input.registrationOpensAt)
    : Number.NaN;
  const closesAt = input.registrationClosesAt
    ? Date.parse(input.registrationClosesAt)
    : Number.NaN;

  if (input.studentAcademicStatus !== "active") {
    blockingReasons.push({
      code: "STUDENT_NOT_ACTIVE",
      message: "Your academic status does not currently permit registration.",
      relatedEntityId: input.studentId,
    });
  }

  if (
    input.termStatus !== "registration_open" ||
    !Number.isFinite(opensAt) ||
    !Number.isFinite(closesAt) ||
    now < opensAt ||
    now > closesAt
  ) {
    blockingReasons.push({
      code: "REGISTRATION_CLOSED",
      message: "Registration is not open for this academic term.",
      relatedEntityId: input.termId,
    });
  }

  if (input.sectionStatus !== "open") {
    blockingReasons.push({
      code: "SECTION_CLOSED",
      message: "This section is not open for registration.",
      relatedEntityId: input.sectionId,
    });
  }

  const availableSeats = input.capacity - input.enrolledCount;
  if (availableSeats <= 0) {
    blockingReasons.push({
      code: "SECTION_FULL",
      message: "This section has no remaining seats.",
      relatedEntityId: input.sectionId,
    });
  } else if (availableSeats <= 3) {
    warnings.push({
      code: "LIMITED_SEATS",
      message: "Only a few seats remain in this section.",
      relatedEntityId: input.sectionId,
    });
  }

  if (input.alreadyEnrolled) {
    blockingReasons.push({
      code: "DUPLICATE_ENROLLMENT",
      message: "You are already registered for this section.",
      relatedEntityId: input.sectionId,
    });
  }

  if (input.repeatRestricted && input.alreadyCompleted) {
    blockingReasons.push({
      code: "COURSE_ALREADY_COMPLETED",
      message: "This course cannot be repeated without institutional approval.",
      relatedEntityId: input.courseId,
    });
  }

  for (const requirement of input.requirements) {
    if (requirement.satisfied) continue;
    blockingReasons.push({
      code:
        requirement.kind === "prerequisite"
          ? "MISSING_PREREQUISITE"
          : "MISSING_COREQUISITE",
      message:
        requirement.kind === "prerequisite"
          ? `${input.courseTitle} requires completion of ${requirement.code} ${requirement.title}.`
          : `${input.courseTitle} must be taken with ${requirement.code} ${requirement.title}.`,
      relatedEntityId: requirement.courseId,
    });
  }

  if (
    input.currentCredits + input.selectedCredits + input.courseCredits >
    input.maxCredits
  ) {
    blockingReasons.push({
      code: "MAX_CREDIT_LOAD",
      message: `This selection would exceed the ${input.maxCredits}-credit term limit.`,
      relatedEntityId: input.termId,
    });
  }

  if (input.blockingHoldId) {
    blockingReasons.push({
      code: "BLOCKING_HOLD",
      message: "A blocking hold must be resolved before registration.",
      relatedEntityId: input.blockingHoldId,
    });
  }

  const conflict = input.targetMeetings
    .flatMap((target) =>
      input.otherMeetings.map((other) => ({ target, other })),
    )
    .find(({ target, other }) => overlaps(target, other));
  if (conflict) {
    blockingReasons.push({
      code: "SCHEDULE_CONFLICT",
      message: "This section overlaps another selected or registered section.",
      relatedEntityId: conflict.other.sectionId,
    });
  }

  if ((input.restrictions.unsupportedKeys?.length ?? 0) > 0) {
    blockingReasons.push({
      code: "UNSUPPORTED_SECTION_RESTRICTION",
      message: "This section has a restriction that requires registrar review.",
      relatedEntityId: input.sectionId,
    });
  }

  if (
    input.restrictions.allowedAcademicStatuses &&
    !input.restrictions.allowedAcademicStatuses.includes(
      input.studentAcademicStatus,
    )
  ) {
    blockingReasons.push({
      code: "SECTION_RESTRICTION",
      message: "Your academic status does not meet this section restriction.",
      relatedEntityId: input.sectionId,
    });
  }

  if (
    input.restrictions.allowedProgramCodes &&
    (!input.studentProgramCode ||
      !input.restrictions.allowedProgramCodes.includes(
        input.studentProgramCode,
      ))
  ) {
    blockingReasons.push({
      code: "SECTION_RESTRICTION",
      message: "Your programme does not meet this section restriction.",
      relatedEntityId: input.sectionId,
    });
  }

  return {
    eligible: blockingReasons.length === 0,
    blockingReasons,
    warnings,
  };
};

export class EnrollmentEligibilityService {
  evaluate(input: EnrollmentEligibilityInput): EnrollmentEligibility {
    return evaluateEnrollmentEligibility(input);
  }
}
