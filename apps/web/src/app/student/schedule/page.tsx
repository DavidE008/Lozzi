import { CalendarDays, Clock3, MapPin, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { WithdrawButton } from "@/components/student/withdraw-button";
import { getAuthenticatedUser } from "@/lib/auth";
import { getRegistrationCatalog } from "@/lib/repositories/registration";

const weekdayNames = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

const formatTime = (value: string) => value.slice(0, 5);

export default async function StudentSchedulePage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  const catalog = await getRegistrationCatalog();
  const enrollments =
    catalog?.courses.flatMap((course) =>
      course.sections
        .filter((section) =>
          ["pending", "enrolled", "waitlisted"].includes(
            section.enrollmentStatus ?? "",
          ),
        )
        .map((section) => ({ course, section })),
    ) ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-lozzi-teal text-xs font-semibold tracking-[0.18em] uppercase">
            {catalog?.termName ?? "Current term"}
          </p>
          <h1 className="font-heading mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            My Schedule
          </h1>
          <p className="text-muted-foreground mt-2">
            Review registered sections and withdrawal availability.
          </p>
        </div>
        <Button render={<Link href="/student/register" />}>Find classes</Button>
      </div>

      {enrollments.length > 0 ? (
        <section className="mt-7 border bg-white">
          <div className="text-muted-foreground bg-lozzi-ivory/70 hidden grid-cols-[8rem_1fr_12rem_9rem] gap-4 border-b px-5 py-3 text-[11px] font-semibold tracking-[0.12em] uppercase md:grid">
            <span>Course</span>
            <span>Meeting</span>
            <span>Instructor</span>
            <span className="text-right">Action</span>
          </div>
          {enrollments.map(({ course, section }) => (
            <article
              key={section.id}
              className="grid gap-4 border-b px-5 py-5 last:border-0 md:grid-cols-[8rem_1fr_12rem_9rem] md:items-center"
            >
              <div>
                <p className="text-lozzi-navy font-semibold">{course.code}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Section {section.code} · {course.creditHours} credits
                </p>
              </div>
              <div className="space-y-1.5 text-sm">
                {section.meetings.length > 0 ? (
                  section.meetings.map((meeting) => (
                    <p
                      key={`${meeting.weekday}-${meeting.startsAt}`}
                      className="flex items-center gap-2"
                    >
                      <Clock3
                        className="text-lozzi-teal size-3.5"
                        aria-hidden="true"
                      />
                      {weekdayNames[meeting.weekday]}{" "}
                      {formatTime(meeting.startsAt)}–
                      {formatTime(meeting.endsAt)}
                    </p>
                  ))
                ) : (
                  <p className="flex items-center gap-2">
                    <CalendarDays className="text-lozzi-teal size-3.5" />
                    Schedule to be announced
                  </p>
                )}
                <p className="text-muted-foreground flex items-center gap-2 text-xs">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {section.location ?? "Location to be announced"}
                </p>
              </div>
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <UserRound className="size-4" aria-hidden="true" />
                {section.instructor}
              </p>
              {section.enrollmentId ? (
                <WithdrawButton enrollmentId={section.enrollmentId} />
              ) : null}
            </article>
          ))}
        </section>
      ) : (
        <section className="mt-7 border bg-white px-6 py-16 text-center">
          <CalendarDays className="text-lozzi-teal mx-auto size-8" />
          <h2 className="font-heading mt-4 text-2xl font-semibold">
            No registered courses
          </h2>
          <p className="text-muted-foreground mt-2">
            Browse available sections to build your schedule.
          </p>
        </section>
      )}
    </div>
  );
}
