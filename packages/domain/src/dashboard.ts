export interface DashboardCourse {
  readonly code: string;
  readonly title: string;
  readonly section: string;
  readonly schedule: string;
  readonly location: string;
  readonly instructor: string;
}

export interface DashboardActivity {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly occurredAt: string;
  readonly tone: "teal" | "gold" | "slate";
}

export interface StudentDashboard {
  readonly studentId: string;
  readonly displayName: string;
  readonly initials: string;
  readonly institutionName: string;
  readonly programName: string;
  readonly academicStanding: string;
  readonly gpa: number;
  readonly creditsEarned: number;
  readonly creditsRequired: number;
  readonly progressPercent: number;
  readonly activeHolds: number;
  readonly currentCourses: readonly DashboardCourse[];
  readonly recentActivity: readonly DashboardActivity[];
}

export interface StudentDashboardRepository {
  getForUser(userId: string): Promise<StudentDashboard | null>;
}

export interface AcademicRecordRepository {
  listPublishedForStudent(studentId: string): Promise<
    readonly {
      readonly id: string;
      readonly courseCode: string;
      readonly courseTitle: string;
      readonly gradeCode: string;
      readonly creditsEarned: number;
      readonly publishedAt: string;
    }[]
  >;
}

export interface EnrollmentRepository {
  listCurrentForStudent(studentId: string): Promise<readonly DashboardCourse[]>;
}

export interface AuditRepository {
  append(event: {
    readonly action: string;
    readonly entityType: string;
    readonly entityId: string;
    readonly outcome: "success" | "denied" | "failed";
  }): Promise<void>;
}
