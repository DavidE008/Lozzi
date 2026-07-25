export type InstitutionRole =
  "student" | "registrar" | "instructor" | "advisor" | "institution_admin";

export interface InstitutionAccess {
  readonly institutionId: string;
  readonly institutionName: string;
  readonly roles: readonly InstitutionRole[];
}

export const hasRegistrarAccess = (roles: readonly InstitutionRole[]) =>
  roles.includes("registrar") || roles.includes("institution_admin");

export const roleHomePath = (roles: readonly InstitutionRole[]) => {
  if (hasRegistrarAccess(roles)) return "/registrar";
  if (roles.includes("student")) return "/student";
  return "/onboarding";
};

export interface RegistrarAttentionItem {
  readonly id: string;
  readonly studentId: string;
  readonly studentDisplayName: string;
  readonly recordType: string;
  readonly courseCode: string;
  readonly courseTitle: string;
  readonly submittedByDisplayName: string;
  readonly submittedAt: string | null;
  readonly status: "submitted" | "approved";
  readonly versionNumber: number;
}

export interface RegistrarStudent {
  readonly id: string;
  readonly displayName: string;
  readonly studentNumber: string;
  readonly academicStatus: string;
  readonly expectedCompletionDate: string | null;
  readonly programName: string | null;
  readonly programVersionNumber: number | null;
}

export interface RegistrarSection {
  readonly id: string;
  readonly termId: string;
  readonly termName: string;
  readonly courseId: string;
  readonly courseCode: string;
  readonly courseTitle: string;
  readonly sectionCode: string;
  readonly capacity: number;
  readonly enrolledCount: number;
  readonly location: string | null;
  readonly deliveryMode: "in_person" | "online" | "hybrid";
  readonly status: "planned" | "open" | "closed" | "cancelled";
  readonly instructors: string;
  readonly schedule: string;
}

export interface RegistrarActivity {
  readonly id: string;
  readonly occurredAt: string;
  readonly actorDisplayName: string;
  readonly actorRole: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly outcome: "success" | "denied" | "failed";
}

export interface RegistrarWorkspace {
  readonly institutionId: string;
  readonly institutionName: string;
  readonly termId: string | null;
  readonly termName: string | null;
  readonly termStatus: string | null;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly registrationOpensAt: string | null;
  readonly registrationClosesAt: string | null;
  readonly addDropDeadline: string | null;
  readonly withdrawalDeadline: string | null;
  readonly gradesDueAt: string | null;
  readonly activeStudentCount: number;
  readonly courseSectionCount: number;
  readonly recordsAwaitingPublication: number;
  readonly attentionItems: readonly RegistrarAttentionItem[];
  readonly recentActivity: readonly RegistrarActivity[];
}

export interface RegistrarWorkspaceRepository {
  getForUser(userId: string): Promise<RegistrarWorkspace | null>;
  listStudents(institutionId: string): Promise<readonly RegistrarStudent[]>;
  listSections(institutionId: string): Promise<readonly RegistrarSection[]>;
  listActivity(institutionId: string): Promise<readonly RegistrarActivity[]>;
}

export interface AcademicStructureRepository {
  createDepartment(input: {
    readonly institutionId: string;
    readonly parentDepartmentId?: string;
    readonly code: string;
    readonly name: string;
  }): Promise<string>;
  deactivateDepartment(id: string): Promise<void>;
  createTerm(input: {
    readonly institutionId: string;
    readonly code: string;
    readonly name: string;
    readonly startsOn: string;
    readonly endsOn: string;
  }): Promise<string>;
  createProgram(input: {
    readonly institutionId: string;
    readonly departmentId: string;
    readonly code: string;
    readonly name: string;
    readonly credentialType: string;
  }): Promise<string>;
  createCourse(input: {
    readonly institutionId: string;
    readonly departmentId: string;
    readonly code: string;
    readonly title: string;
    readonly creditHours: number;
  }): Promise<string>;
  createSection(input: {
    readonly institutionId: string;
    readonly courseId: string;
    readonly termId: string;
    readonly sectionCode: string;
    readonly capacity: number;
  }): Promise<string>;
}

export interface MembershipAdministrationRepository {
  deactivateMembership(id: string): Promise<void>;
  assignStaffRole(input: {
    readonly institutionId: string;
    readonly userId: string;
    readonly role: Exclude<InstitutionRole, "student">;
    readonly validUntil?: string;
  }): Promise<string>;
  deactivateStaffRole(id: string): Promise<void>;
}
