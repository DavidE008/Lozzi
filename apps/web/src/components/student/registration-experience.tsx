"use client";

import type {
  RegistrationCatalog,
  RegistrationCourse,
  RegistrationSection,
} from "@/lib/repositories/registration";
import {
  AlertCircle,
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Info,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import {
  type RegistrationActionResult,
  submitRegistration,
} from "@/app/student/register/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const weekdayNames = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const formatTime = (value: string) => {
  const [hour = "0", minute = "00"] = value.split(":");
  const date = new Date(2000, 0, 1, Number(hour), Number(minute));
  return date.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatMeetings = (section: RegistrationSection) => {
  if (section.meetings.length === 0) return "Schedule to be announced";
  const grouped = new Map<string, string[]>();
  for (const meeting of section.meetings) {
    const key = `${formatTime(meeting.startsAt)}–${formatTime(meeting.endsAt)}`;
    grouped.set(key, [
      ...(grouped.get(key) ?? []),
      weekdayNames[meeting.weekday],
    ]);
  }
  return [...grouped.entries()]
    .map(([time, days]) => `${days.join("/")} ${time}`)
    .join(", ");
};

const sectionTone = (section: RegistrationSection) => {
  if (
    section.enrollmentStatus &&
    ["pending", "enrolled", "waitlisted"].includes(section.enrollmentStatus)
  ) {
    return { label: "Registered", className: "bg-lozzi-navy text-white" };
  }
  if (section.eligibility.eligible) {
    return {
      label: section.availableSeats <= 3 ? "Limited seats" : "Eligible",
      className: "bg-emerald-50 text-emerald-800 border-emerald-200",
    };
  }
  return {
    label: "Not eligible",
    className: "bg-rose-50 text-rose-800 border-rose-200",
  };
};

function CourseRow({
  course,
  expanded,
  onExpand,
  selectedSectionIds,
  onSelect,
}: {
  readonly course: RegistrationCourse;
  readonly expanded: boolean;
  readonly onExpand: () => void;
  readonly selectedSectionIds: ReadonlySet<string>;
  readonly onSelect: (section: RegistrationSection) => void;
}) {
  const primarySection = course.sections[0];
  if (!primarySection) return null;
  const registered = course.sections.some((section) =>
    ["pending", "enrolled", "waitlisted"].includes(
      section.enrollmentStatus ?? "",
    ),
  );
  const eligible = course.sections.some(
    (section) => section.eligibility.eligible,
  );
  const tone = sectionTone(
    registered
      ? (course.sections.find((section) => section.enrollmentStatus) ??
          primarySection)
      : primarySection,
  );

  return (
    <article className="border-b last:border-b-0">
      <button
        type="button"
        className="hover:bg-muted/45 grid w-full grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 text-left transition-colors md:grid-cols-[8.5rem_1fr_5rem_8rem_2rem]"
        onClick={onExpand}
        aria-expanded={expanded}
        aria-controls={`course-${course.id}`}
      >
        <span className="text-lozzi-navy font-semibold">{course.code}</span>
        <span className="min-w-0">
          <span className="text-lozzi-navy block font-medium">
            {course.title}
          </span>
          <span className="text-muted-foreground mt-0.5 block text-xs md:hidden">
            {course.creditHours} credits · {course.sections.length} section
            {course.sections.length === 1 ? "" : "s"}
          </span>
        </span>
        <span className="text-muted-foreground hidden text-sm md:block">
          {course.creditHours}
        </span>
        <Badge
          variant="outline"
          className={cn(
            "hidden justify-center font-medium md:flex",
            tone.className,
          )}
        >
          {registered ? "Registered" : eligible ? tone.label : "Not eligible"}
        </Badge>
        {expanded ? (
          <ChevronUp className="size-4" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-4" aria-hidden="true" />
        )}
      </button>

      {expanded ? (
        <div
          id={`course-${course.id}`}
          className="bg-lozzi-ivory/55 border-t px-5 py-5"
        >
          {course.prerequisites.length > 0 ? (
            <p className="text-muted-foreground mb-4 flex items-center gap-2 text-sm">
              <ShieldCheck
                className="text-lozzi-teal size-4"
                aria-hidden="true"
              />
              {course.prerequisites
                .map(
                  (requirement) =>
                    `${requirement.kind === "corequisite" ? "Corequisite" : "Prerequisite"}: ${requirement.code}`,
                )
                .join(" · ")}
            </p>
          ) : null}

          <div className="space-y-3">
            {course.sections.map((section) => {
              const selected = selectedSectionIds.has(section.id);
              const status = sectionTone(section);
              const alreadyRegistered =
                section.enrollmentStatus !== null &&
                ["pending", "enrolled", "waitlisted"].includes(
                  section.enrollmentStatus,
                );
              return (
                <div
                  key={section.id}
                  className={cn(
                    "grid gap-4 rounded-sm border bg-white p-4 md:grid-cols-[1fr_auto] md:items-center",
                    selected && "border-lozzi-teal ring-lozzi-teal/15 ring-2",
                  )}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lozzi-navy font-semibold">
                        Section {section.code}
                      </span>
                      <Badge variant="outline" className={status.className}>
                        {status.label}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
                      <span className="flex items-center gap-2">
                        <Clock3 className="size-3.5" aria-hidden="true" />
                        {formatMeetings(section)}
                      </span>
                      <span className="flex items-center gap-2">
                        <Users className="size-3.5" aria-hidden="true" />
                        {section.instructor}
                      </span>
                      <span>
                        {section.location ?? "Location to be announced"}
                      </span>
                      <span>
                        {section.availableSeats} of {section.capacity} seats
                        available
                      </span>
                    </div>

                    {section.eligibility.blockingReasons.length > 0 ? (
                      <ul
                        className="mt-3 space-y-1"
                        aria-label="Eligibility issues"
                      >
                        {section.eligibility.blockingReasons.map((reason) => (
                          <li
                            key={`${section.id}-${reason.code}-${reason.relatedEntityId}`}
                            className="flex gap-2 text-sm text-rose-700"
                          >
                            <AlertCircle
                              className="mt-0.5 size-4 shrink-0"
                              aria-hidden="true"
                            />
                            {reason.message}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 flex items-center gap-2 text-sm text-emerald-700">
                        <Check className="size-4" aria-hidden="true" />
                        All registration requirements are satisfied.
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant={selected ? "secondary" : "default"}
                    disabled={
                      !section.eligibility.eligible || alreadyRegistered
                    }
                    onClick={() => onSelect(section)}
                    className="min-w-28"
                  >
                    {alreadyRegistered
                      ? "Registered"
                      : selected
                        ? "Remove"
                        : "Add section"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function RegistrationExperience({
  catalog,
}: {
  readonly catalog: RegistrationCatalog | null;
}) {
  const [query, setQuery] = useState("");
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(
    catalog?.courses.find((course) => course.code === "CS 2305")?.id ??
      catalog?.courses[0]?.id ??
      null,
  );
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(
    new Set(),
  );
  const [feedback, setFeedback] = useState<RegistrationActionResult | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const filteredCourses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return catalog?.courses ?? [];
    return (catalog?.courses ?? []).filter((course) =>
      `${course.code} ${course.title}`.toLowerCase().includes(normalized),
    );
  }, [catalog, query]);

  const selectedSections = useMemo(
    () =>
      (catalog?.courses ?? []).flatMap((course) =>
        course.sections
          .filter((section) => selectedSectionIds.has(section.id))
          .map((section) => ({ course, section })),
      ),
    [catalog, selectedSectionIds],
  );

  const selectionCredits = selectedSections.reduce(
    (sum, { course }) => sum + course.creditHours,
    0,
  );

  const toggleSection = (
    course: RegistrationCourse,
    section: RegistrationSection,
  ) => {
    setFeedback(null);
    setSelectedSectionIds((current) => {
      const next = new Set(current);
      if (next.has(section.id)) {
        next.delete(section.id);
      } else {
        for (const sibling of course.sections) next.delete(sibling.id);
        next.add(section.id);
      }
      return next;
    });
  };

  const submit = () => {
    if (selectedSectionIds.size === 0) return;
    startTransition(async () => {
      const result = await submitRegistration({
        sectionIds: [...selectedSectionIds],
        idempotencyKey: crypto.randomUUID(),
      });
      setFeedback(result);
      if (result.success) setSelectedSectionIds(new Set());
    });
  };

  if (!catalog) {
    return (
      <section className="mx-auto max-w-3xl border bg-white px-6 py-16 text-center">
        <BookOpenCheck
          className="text-lozzi-teal mx-auto size-8"
          aria-hidden="true"
        />
        <h1 className="font-heading mt-4 text-3xl font-semibold">
          Registration is not available
        </h1>
        <p className="text-muted-foreground mt-2">
          Your institution has not published course offerings for an available
          term.
        </p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-[88rem]">
      <div className="mb-7">
        <p className="text-lozzi-teal text-xs font-semibold tracking-[0.18em] uppercase">
          {catalog.termName}
        </p>
        <h1 className="font-heading mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Register for Classes
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm sm:text-base">
          Search the course schedule, review your eligibility, and build a plan
          before submitting.
        </p>
      </div>

      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-w-0 border bg-white">
          <div className="border-b p-5">
            <label
              htmlFor="course-search"
              className="mb-2 block text-xs font-semibold tracking-[0.12em] uppercase"
            >
              Course search
            </label>
            <div className="relative">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                id="course-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by course code or title"
                className="h-11 pl-10"
              />
            </div>
          </div>

          <div className="text-muted-foreground bg-lozzi-ivory/70 hidden grid-cols-[8.5rem_1fr_5rem_8rem_2rem] gap-4 border-b px-5 py-2.5 text-[11px] font-semibold tracking-[0.12em] uppercase md:grid">
            <span>Course</span>
            <span>Title</span>
            <span>Credits</span>
            <span>Status</span>
            <span className="sr-only">Expand</span>
          </div>

          {filteredCourses.length > 0 ? (
            filteredCourses.map((course) => (
              <CourseRow
                key={course.id}
                course={course}
                expanded={expandedCourseId === course.id}
                onExpand={() =>
                  setExpandedCourseId((current) =>
                    current === course.id ? null : course.id,
                  )
                }
                selectedSectionIds={selectedSectionIds}
                onSelect={(section) => toggleSection(course, section)}
              />
            ))
          ) : (
            <div className="px-6 py-16 text-center">
              <Search className="text-muted-foreground mx-auto size-7" />
              <p className="mt-3 font-medium">No matching courses</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Try a course code such as CS or MATH.
              </p>
            </div>
          )}
        </section>

        <aside className="space-y-4 xl:sticky xl:top-28">
          <section className="border bg-white">
            <div className="border-b px-5 py-4">
              <p className="text-lozzi-teal text-[11px] font-semibold tracking-[0.15em] uppercase">
                Planned schedule
              </p>
              <h2 className="font-heading mt-1 text-xl font-semibold">
                Review your selection
              </h2>
            </div>
            <div className="min-h-36 p-5">
              {selectedSections.length > 0 ? (
                <ul className="space-y-4">
                  {selectedSections.map(({ course, section }) => (
                    <li
                      key={section.id}
                      className="border-b pb-4 last:border-0"
                    >
                      <p className="text-lozzi-navy font-semibold">
                        {course.code}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-sm">
                        {course.title}
                      </p>
                      <p className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
                        <CalendarDays className="size-3.5" aria-hidden="true" />
                        {formatMeetings(section)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-muted-foreground py-4 text-center text-sm">
                  <CalendarDays className="mx-auto mb-3 size-6 opacity-60" />
                  Add an eligible section to build your schedule.
                </div>
              )}
            </div>
            <div className="bg-lozzi-ivory/70 border-t px-5 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Selected credits</span>
                <strong>{selectionCredits}</strong>
              </div>
            </div>
            <div className="p-5">
              <Button
                className="w-full"
                disabled={selectedSectionIds.size === 0 || isPending}
                onClick={submit}
              >
                {isPending ? "Submitting…" : "Review and Submit"}
              </Button>
              {feedback ? (
                <p
                  role="status"
                  className={cn(
                    "mt-3 flex gap-2 text-sm",
                    feedback.success ? "text-emerald-700" : "text-rose-700",
                  )}
                >
                  {feedback.success ? (
                    <Check className="mt-0.5 size-4 shrink-0" />
                  ) : (
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  )}
                  {feedback.message}
                </p>
              ) : null}
            </div>
          </section>

          <section className="border border-amber-200 bg-amber-50/70 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <Clock3 className="size-4" aria-hidden="true" />
              Registration window
            </p>
            <p className="mt-2 text-sm text-amber-900/75">
              Registration closes{" "}
              {catalog.registrationClosesAt
                ? new Date(catalog.registrationClosesAt).toLocaleDateString(
                    "en-GB",
                    {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    },
                  )
                : "on the published institutional deadline"}
              .
            </p>
          </section>

          <section className="border bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Info className="text-lozzi-teal size-4" aria-hidden="true" />
              Registration tips
            </p>
            <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-sm">
              <li>Expand a course to compare sections.</li>
              <li>Resolve holds before submitting.</li>
              <li>Check meeting times for conflicts.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
