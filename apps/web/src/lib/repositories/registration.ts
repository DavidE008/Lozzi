import type { EnrollmentEligibility } from "@lozzi/domain";
import { cache } from "react";
import { z } from "zod";

import { logEvent } from "@/lib/logging";
import { createClient } from "@/lib/supabase/server";

const reasonSchema = z.object({
  code: z.string(),
  message: z.string(),
  relatedEntityId: z.string(),
});

const eligibilitySchema = z.object({
  eligible: z.boolean(),
  blockingReasons: z.array(reasonSchema),
  warnings: z.array(reasonSchema),
});

const meetingSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  startsAt: z.string(),
  endsAt: z.string(),
  location: z.string().nullable(),
});

const prerequisiteSchema = z.object({
  courseId: z.string(),
  code: z.string(),
  title: z.string(),
  kind: z.enum(["prerequisite", "corequisite"]),
});

const catalogRowSchema = z.object({
  student_id: z.string(),
  institution_id: z.string(),
  term_id: z.string(),
  term_name: z.string(),
  registration_closes_at: z.string().nullable(),
  add_drop_deadline: z.string().nullable(),
  section_id: z.string(),
  course_id: z.string(),
  course_code: z.string(),
  course_title: z.string(),
  credit_hours: z.coerce.number(),
  section_code: z.string(),
  capacity: z.number().int(),
  enrolled_count: z.number().int(),
  available_seats: z.number().int(),
  location: z.string().nullable(),
  delivery_mode: z.string(),
  section_status: z.string(),
  instructor: z.string(),
  meetings: z.array(meetingSchema),
  prerequisites: z.array(prerequisiteSchema),
  enrollment_id: z.string().nullable(),
  enrollment_status: z.string().nullable(),
  eligibility: eligibilitySchema,
});

interface RegistrationRpcClient {
  rpc(
    functionName: "get_registration_catalog",
    parameters?: { readonly p_term_id?: string | null },
  ): Promise<{
    readonly data: unknown;
    readonly error: { readonly code?: string } | null;
  }>;
}

export interface RegistrationMeeting {
  readonly weekday: number;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly location: string | null;
}

export interface RegistrationSection {
  readonly id: string;
  readonly code: string;
  readonly capacity: number;
  readonly enrolledCount: number;
  readonly availableSeats: number;
  readonly location: string | null;
  readonly deliveryMode: string;
  readonly status: string;
  readonly instructor: string;
  readonly meetings: readonly RegistrationMeeting[];
  readonly enrollmentId: string | null;
  readonly enrollmentStatus: string | null;
  readonly eligibility: EnrollmentEligibility;
}

export interface RegistrationCourse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly creditHours: number;
  readonly prerequisites: readonly {
    readonly courseId: string;
    readonly code: string;
    readonly title: string;
    readonly kind: "prerequisite" | "corequisite";
  }[];
  readonly sections: readonly RegistrationSection[];
}

export interface RegistrationCatalog {
  readonly studentId: string;
  readonly institutionId: string;
  readonly termId: string;
  readonly termName: string;
  readonly registrationClosesAt: string | null;
  readonly addDropDeadline: string | null;
  readonly courses: readonly RegistrationCourse[];
}

export const mapRegistrationCatalog = (source: unknown): RegistrationCatalog | null => {
  const rows = z.array(catalogRowSchema).parse(source);
  const first = rows[0];
  if (!first) return null;

  const courses = new Map<string, RegistrationCourse>();
  for (const row of rows) {
    const current = courses.get(row.course_id);
    const section: RegistrationSection = {
      id: row.section_id,
      code: row.section_code,
      capacity: row.capacity,
      enrolledCount: row.enrolled_count,
      availableSeats: row.available_seats,
      location: row.location,
      deliveryMode: row.delivery_mode,
      status: row.section_status,
      instructor: row.instructor,
      meetings: row.meetings,
      enrollmentId: row.enrollment_id,
      enrollmentStatus: row.enrollment_status,
      eligibility: row.eligibility as EnrollmentEligibility,
    };

    if (current) {
      courses.set(row.course_id, {
        ...current,
        sections: [...current.sections, section],
      });
    } else {
      courses.set(row.course_id, {
        id: row.course_id,
        code: row.course_code,
        title: row.course_title,
        creditHours: row.credit_hours,
        prerequisites: row.prerequisites,
        sections: [section],
      });
    }
  }

  return {
    studentId: first.student_id,
    institutionId: first.institution_id,
    termId: first.term_id,
    termName: first.term_name,
    registrationClosesAt: first.registration_closes_at,
    addDropDeadline: first.add_drop_deadline,
    courses: [...courses.values()],
  };
};

export const getRegistrationCatalog = cache(
  async (termId?: string): Promise<RegistrationCatalog | null> => {
    const supabase = (await createClient()) as unknown as RegistrationRpcClient;
    const { data, error } = await supabase.rpc(
      "get_registration_catalog",
      termId ? { p_term_id: termId } : undefined,
    );

    if (error) {
      logEvent("error", "registration_catalog_failed", {
        category: error.code ?? "unknown",
      });
      throw new Error("Registration options could not be loaded.");
    }

    return mapRegistrationCatalog(data);
  },
);

