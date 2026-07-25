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
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Filter,
  Info,
  Search,
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

const courseDepartment = (course: RegistrationCourse) =>
  course.code.split(" ")[0] ?? "Other";

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
        className="hover:bg-muted/45 grid w-full grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 text-left transition-colors md:grid-cols-[7.25rem_1fr_4rem_7.5rem_7rem_1rem]"
        onClick={onExpand}
        aria-expanded={expanded}
        aria-controls={`course-${course.id}`}
        aria-label={`${course.code} ${course.title}`}
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
        <span className="text-muted-foreground hidden truncate text-sm md:block">
          {course.prerequisites.length > 0
            ? course.prerequisites
                .map((requirement) => requirement.code)
                .join(", ")
            : "None"}
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
          className="border-lozzi-slate/40 border-t bg-white px-4 py-4"
        >
          <div className="grid border xl:grid-cols-[0.9fr_1.4fr_1fr]">
            <section className="border-b p-4 xl:border-r xl:border-b-0">
              <h3 className="font-heading text-sm font-semibold">
                About this course
              </h3>
              <p className="text-muted-foreground mt-3 text-xs leading-5">
                Review the published meeting pattern, instructor, available
                seats, and eligibility before adding this course.
              </p>
              <dl className="mt-5 space-y-2.5 border-t pt-3 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Department</dt>
                  <dd className="font-medium">{courseDepartment(course)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Credits</dt>
                  <dd className="font-medium">{course.creditHours}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Instruction mode</dt>
                  <dd className="font-medium capitalize">
                    {primarySection.deliveryMode.replaceAll("_", " ")}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="border-b p-4 xl:border-r xl:border-b-0">
              <h3 className="font-heading text-sm font-semibold">
                Select a section
              </h3>
              <div className="text-muted-foreground mt-3 grid grid-cols-[3rem_1fr_1fr_4rem] gap-2 border-b pb-2 text-[10px] font-semibold tracking-wide uppercase">
                <span>Section</span>
                <span>Meeting time</span>
                <span>Instructor</span>
                <span className="text-right">Seats</span>
              </div>
              <div className="divide-y">
                {course.sections.map((section) => {
                  const selected = selectedSectionIds.has(section.id);
                  const alreadyRegistered =
                    section.enrollmentStatus !== null &&
                    ["pending", "enrolled", "waitlisted"].includes(
                      section.enrollmentStatus,
                    );
                  return (
                    <button
                      type="button"
                      key={section.id}
                      className={cn(
                        "grid w-full grid-cols-[3rem_1fr_1fr_4rem] items-center gap-2 px-1 py-3 text-left text-xs",
                        selected && "bg-lozzi-teal/8",
                      )}
                      disabled={
                        !section.eligibility.eligible || alreadyRegistered
                      }
                      onClick={() => onSelect(section)}
                    >
                      <span className="flex items-center gap-1.5 font-semibold">
                        <span
                          className={cn(
                            "border-lozzi-slate/60 block size-3 rounded-full border",
                            selected && "border-lozzi-teal bg-lozzi-teal",
                          )}
                          aria-hidden="true"
                        />
                        {section.code}
                      </span>
                      <span>{formatMeetings(section)}</span>
                      <span>{section.instructor}</span>
                      <span className="text-right">
                        {section.availableSeats}/{section.capacity}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs">
                <Clock3 className="size-3.5" aria-hidden="true" />
                {primarySection.location ?? "Location to be announced"}
              </p>
            </section>

            <section className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-sm font-semibold">
                  Eligibility check
                </h3>
                <Badge
                  variant="outline"
                  className={cn(
                    primarySection.eligibility.eligible
                      ? "border-lozzi-teal text-emerald-800"
                      : "border-rose-200 text-rose-800",
                  )}
                >
                  {primarySection.eligibility.eligible
                    ? "Eligible"
                    : registered
                      ? "Registered"
                      : "Action needed"}
                </Badge>
              </div>
              <ul className="mt-3 divide-y text-xs">
                {[
                  ["Academic status", "Active"],
                  ["Registration open", "Yes"],
                  [
                    "Prerequisite",
                    course.prerequisites.length > 0
                      ? course.prerequisites.map((item) => item.code).join(", ")
                      : "None",
                  ],
                  ["Seats available", `${primarySection.availableSeats} open`],
                  ["Schedule conflict", "None detected"],
                ].map(([label, value]) => (
                  <li
                    key={label}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle2
                        className="text-lozzi-teal size-3.5"
                        aria-hidden="true"
                      />
                      {label}
                    </span>
                    <span className="text-muted-foreground text-right">
                      {value}
                    </span>
                  </li>
                ))}
              </ul>

              {primarySection.eligibility.blockingReasons.length > 0 ? (
                <ul
                  className="mt-3 space-y-1.5"
                  aria-label="Eligibility issues"
                >
                  {primarySection.eligibility.blockingReasons.map((reason) => (
                    <li
                      key={`${primarySection.id}-${reason.code}-${reason.relatedEntityId}`}
                      className="flex gap-2 border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900"
                    >
                      <AlertCircle
                        className="mt-0.5 size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      {reason.message}
                    </li>
                  ))}
                </ul>
              ) : null}

              <Button
                type="button"
                variant={
                  selectedSectionIds.has(primarySection.id)
                    ? "secondary"
                    : "default"
                }
                disabled={
                  !primarySection.eligibility.eligible ||
                  primarySection.enrollmentStatus !== null
                }
                onClick={() => onSelect(primarySection)}
                className="mt-3 w-full"
              >
                {registered
                  ? "Already registered"
                  : selectedSectionIds.has(primarySection.id)
                    ? "Remove from plan"
                    : `Add ${course.code}`}
              </Button>
            </section>
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
  const [department, setDepartment] = useState("all");
  const [credits, setCredits] = useState("all");
  const [openOnly, setOpenOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState("code");
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
    const matches = (catalog?.courses ?? []).filter(
      (course) =>
        (!normalized ||
          `${course.code} ${course.title}`
            .toLowerCase()
            .includes(normalized)) &&
        (department === "all" || courseDepartment(course) === department) &&
        (credits === "all" || String(course.creditHours) === credits) &&
        (!openOnly ||
          course.sections.some(
            (section) =>
              section.status === "open" && section.availableSeats > 0,
          )),
    );
    return [...matches].sort((left, right) =>
      sortOrder === "title"
        ? left.title.localeCompare(right.title)
        : left.code.localeCompare(right.code),
    );
  }, [catalog, credits, department, openOnly, query, sortOrder]);

  const departmentOptions = useMemo(
    () => [...new Set((catalog?.courses ?? []).map(courseDepartment))].sort(),
    [catalog],
  );

  const creditOptions = useMemo(
    () =>
      [
        ...new Set(
          (catalog?.courses ?? []).map((course) => course.creditHours),
        ),
      ].sort((left, right) => left - right),
    [catalog],
  );

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
      <div className="mb-5">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Register for Classes
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm sm:text-base">
          Search for courses, review eligibility, and add to your schedule.
        </p>
      </div>

      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_19.5rem]">
        <section className="min-w-0 border bg-white">
          <div className="border-b p-3">
            <div className="flex items-center gap-3">
              <div className="relative min-w-0 flex-1">
                <label htmlFor="course-search" className="sr-only">
                  Course search
                </label>
                <Search
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                  aria-hidden="true"
                />
                <Input
                  id="course-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by course title or code"
                  className="h-9 pl-10"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="hidden sm:flex"
              >
                <Filter aria-hidden="true" />
                Filters
              </Button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[11rem_11rem_1fr]">
              <label>
                <span className="sr-only">Department</span>
                <select
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  className="border-input h-9 w-full rounded-sm border bg-transparent px-3 text-sm"
                >
                  <option value="all">All departments</option>
                  {departmentOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Credits</span>
                <select
                  value={credits}
                  onChange={(event) => setCredits(event.target.value)}
                  className="border-input h-9 w-full rounded-sm border bg-transparent px-3 text-sm"
                >
                  <option value="all">All credits</option>
                  {creditOptions.map((option) => (
                    <option key={option} value={String(option)}>
                      {option} credits
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-muted-foreground flex min-h-9 items-center gap-2 px-1 text-sm">
                <input
                  type="checkbox"
                  checked={openOnly}
                  onChange={(event) => setOpenOnly(event.target.checked)}
                  className="accent-lozzi-teal size-4"
                />
                Show open sections only
              </label>
            </div>
          </div>

          <div className="text-muted-foreground flex items-center justify-between border-b px-1 py-2 text-xs">
            <span>
              Showing {filteredCourses.length} course
              {filteredCourses.length === 1 ? "" : "s"}
            </span>
            <label className="flex items-center gap-2">
              <span>Sort by:</span>
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                className="bg-transparent font-medium text-current"
              >
                <option value="code">Course code (A–Z)</option>
                <option value="title">Course title (A–Z)</option>
              </select>
            </label>
          </div>

          <div className="text-muted-foreground bg-lozzi-ivory/70 hidden grid-cols-[7.25rem_1fr_4rem_7.5rem_7rem_1rem] gap-4 border-b px-4 py-2 text-[10px] font-semibold tracking-[0.12em] uppercase md:grid">
            <span>Course</span>
            <span>Title</span>
            <span>Credits</span>
            <span>Prerequisites</span>
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

        <aside className="space-y-4 xl:sticky xl:top-28 xl:-mt-[5.75rem]">
          <section className="border bg-white">
            <div className="border-b px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-heading text-lg font-semibold">
                  Planned schedule
                </h2>
                <span className="text-muted-foreground text-xs">
                  {selectedSections.length} courses · {selectionCredits} credits
                </span>
              </div>
            </div>
            <div className="min-h-[21rem] p-5">
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
                <div className="text-muted-foreground flex min-h-[19rem] flex-col items-center justify-center text-center text-sm">
                  <CalendarDays className="mb-4 size-10 opacity-60" />
                  <strong className="text-foreground font-medium">
                    No courses planned yet.
                  </strong>
                  <span className="mt-2 max-w-40">
                    Select an eligible section to add it here.
                  </span>
                </div>
              )}
            </div>
            <div className="bg-lozzi-ivory/70 border-t px-5 py-3 text-sm">
              <div className="flex justify-between">
                <span>Total planned credits</span>
                <strong>{selectionCredits} / 18</strong>
              </div>
            </div>
          </section>

          <section className="border border-blue-200 bg-blue-50/50 p-4">
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

          <section className="border-t border-b bg-transparent py-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Clock3 className="size-4" aria-hidden="true" />
                Registration window
              </p>
              <Badge
                variant="outline"
                className="border-lozzi-teal text-emerald-800"
              >
                Open
              </Badge>
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-5">
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

          <div>
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
        </aside>
      </div>
    </div>
  );
}
