"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, LoaderCircle, Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  assignSectionInstructor,
  createSection,
  createSectionMeeting,
  deactivateSectionResource,
  updateSection,
} from "@/app/registrar/sections/actions";
import { MutationFeedback } from "@/components/registrar/mutation-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RegistrarActionResult } from "@/lib/registrar/mutation-context";
import type {
  RegistrarCatalog,
  RegistrarStaffMember,
  RegistrarTerm,
} from "@/lib/repositories/registrar-administration";

const selectClass =
  "border-input bg-background h-9 w-full rounded-sm border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20";
const sectionSchema = z.object({
  courseId: z.string().min(1),
  termId: z.string().min(1),
  sectionCode: z.string().trim().min(1).max(16),
  capacity: z.number().int().positive().max(9999),
  location: z.string().trim().max(160).optional(),
  deliveryMode: z.enum(["in_person", "online", "hybrid"]),
  status: z.enum(["planned", "open", "closed", "cancelled"]),
});
const instructorSchema = z.object({
  sectionId: z.string().min(1),
  staffRoleAssignmentId: z.string().min(1),
  isPrimary: z.boolean(),
});
const meetingSchema = z
  .object({
    sectionId: z.string().min(1),
    weekday: z.number().int().min(1).max(7),
    startsAt: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    endsAt: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    location: z.string().trim().max(160).optional(),
    startsOn: z.string().optional(),
    endsOn: z.string().optional(),
  })
  .refine((value) => value.endsAt > value.startsAt, {
    message: "The meeting must end after it starts.",
    path: ["endsAt"],
  });
const sectionUpdateSchema = z.object({
  capacity: z.number().int().positive().max(9999),
  location: z.string().trim().max(160).optional(),
  deliveryMode: z.enum(["in_person", "online", "hybrid"]),
  status: z.enum(["planned", "open", "closed", "cancelled"]),
});

export function SectionManager({
  institutionId,
  catalog,
  terms,
  staff,
  sections,
}: {
  readonly institutionId: string;
  readonly catalog: RegistrarCatalog;
  readonly terms: readonly RegistrarTerm[];
  readonly staff: readonly RegistrarStaffMember[];
  readonly sections: readonly { readonly id: string; readonly label: string }[];
}) {
  const router = useRouter();
  const [result, setResult] = useState<RegistrarActionResult>();
  const [pending, startTransition] = useTransition();
  const instructors = staff.filter(
    (member) => member.role === "instructor" && member.status === "active",
  );

  const run = (
    operation: () => Promise<RegistrarActionResult>,
    reset: () => void,
  ) =>
    startTransition(async () => {
      setResult(undefined);
      const next = await operation();
      setResult(next);
      if (next.success) {
        reset();
        router.refresh();
      }
    });

  const section = useForm<z.infer<typeof sectionSchema>>({
    resolver: zodResolver(sectionSchema),
    defaultValues: {
      courseId: catalog.courses[0]?.id ?? "",
      termId: terms[0]?.id ?? "",
      sectionCode: "001",
      capacity: 30,
      location: "",
      deliveryMode: "in_person",
      status: "planned",
    },
  });
  const instructor = useForm<z.infer<typeof instructorSchema>>({
    resolver: zodResolver(instructorSchema),
    defaultValues: {
      sectionId: sections[0]?.id ?? "",
      staffRoleAssignmentId: instructors[0]?.assignmentId ?? "",
      isPrimary: false,
    },
  });
  const meeting = useForm<z.infer<typeof meetingSchema>>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      sectionId: sections[0]?.id ?? "",
      weekday: 1,
      startsAt: "09:00",
      endsAt: "10:15",
      location: "",
      startsOn: "",
      endsOn: "",
    },
  });

  return (
    <details className="bg-card mb-7 rounded-sm border">
      <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">
        Add section resources
      </summary>
      <div className="space-y-5 border-t p-5">
        <MutationFeedback result={result} />
        <div className="grid gap-7 xl:grid-cols-3">
          <form
            className="space-y-3"
            onSubmit={section.handleSubmit((values) =>
              run(
                () => createSection({ institutionId, ...values }),
                () => section.reset(),
              ),
            )}
          >
            <p className="text-lozzi-slate text-xs font-semibold tracking-wider uppercase">
              Course section
            </p>
            <select
              aria-label="Course"
              className={selectClass}
              {...section.register("courseId")}
            >
              {catalog.courses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.title}
                </option>
              ))}
            </select>
            <select
              aria-label="Academic term"
              className={selectClass}
              {...section.register("termId")}
            >
              {terms
                .filter((item) => !item.deactivatedAt)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                aria-label="Section code"
                {...section.register("sectionCode")}
              />
              <Input
                aria-label="Capacity"
                type="number"
                {...section.register("capacity", { valueAsNumber: true })}
              />
            </div>
            <Input
              aria-label="Section location"
              placeholder="Innovation Hall 204"
              {...section.register("location")}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                aria-label="Delivery mode"
                className={selectClass}
                {...section.register("deliveryMode")}
              >
                <option value="in_person">In person</option>
                <option value="online">Online</option>
                <option value="hybrid">Hybrid</option>
              </select>
              <select
                aria-label="Initial section status"
                className={selectClass}
                {...section.register("status")}
              >
                <option value="planned">Planned</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Plus aria-hidden="true" />
              )}
              Add section
            </Button>
          </form>

          <form
            className="space-y-3"
            onSubmit={instructor.handleSubmit((values) =>
              run(
                () => assignSectionInstructor({ institutionId, ...values }),
                () => instructor.reset(),
              ),
            )}
          >
            <p className="text-lozzi-slate text-xs font-semibold tracking-wider uppercase">
              Instructor assignment
            </p>
            <select
              aria-label="Section"
              className={selectClass}
              {...instructor.register("sectionId")}
            >
              {sections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Instructor"
              className={selectClass}
              {...instructor.register("staffRoleAssignmentId")}
            >
              {instructors.map((item) => (
                <option key={item.assignmentId} value={item.assignmentId}>
                  {item.displayName}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...instructor.register("isPrimary")} />
              Primary instructor
            </label>
            <Button
              type="submit"
              size="sm"
              disabled={pending || !instructors.length}
            >
              {pending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Plus aria-hidden="true" />
              )}
              Assign instructor
            </Button>
          </form>

          <form
            className="space-y-3"
            onSubmit={meeting.handleSubmit((values) =>
              run(
                () => createSectionMeeting({ institutionId, ...values }),
                () => meeting.reset(),
              ),
            )}
          >
            <p className="text-lozzi-slate text-xs font-semibold tracking-wider uppercase">
              Meeting
            </p>
            <select
              aria-label="Meeting section"
              className={selectClass}
              {...meeting.register("sectionId")}
            >
              {sections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-3">
              <select
                aria-label="Weekday"
                className={selectClass}
                {...meeting.register("weekday", { valueAsNumber: true })}
              >
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                  (day, index) => (
                    <option key={day} value={index + 1}>
                      {day}
                    </option>
                  ),
                )}
              </select>
              <Input
                aria-label="Starts at"
                type="time"
                {...meeting.register("startsAt")}
              />
              <Input
                aria-label="Ends at"
                type="time"
                {...meeting.register("endsAt")}
              />
            </div>
            <Input
              aria-label="Meeting location"
              placeholder="Innovation Hall 204"
              {...meeting.register("location")}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="meeting-starts-on">Starts on</Label>
                <Input
                  id="meeting-starts-on"
                  type="date"
                  {...meeting.register("startsOn")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meeting-ends-on">Ends on</Label>
                <Input
                  id="meeting-ends-on"
                  type="date"
                  {...meeting.register("endsOn")}
                />
              </div>
            </div>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Plus aria-hidden="true" />
              )}
              Add meeting
            </Button>
          </form>
        </div>
      </div>
    </details>
  );
}

export function SectionControls({
  institutionId,
  section,
}: {
  readonly institutionId: string;
  readonly section: {
    readonly id: string;
    readonly capacity: number;
    readonly location: string | null;
    readonly deliveryMode: "in_person" | "online" | "hybrid";
    readonly status: "planned" | "open" | "closed" | "cancelled";
  };
}) {
  const router = useRouter();
  const [result, setResult] = useState<RegistrarActionResult>();
  const [pending, startTransition] = useTransition();
  const form = useForm<z.infer<typeof sectionUpdateSchema>>({
    resolver: zodResolver(sectionUpdateSchema),
    defaultValues: {
      capacity: section.capacity,
      location: section.location ?? "",
      deliveryMode: section.deliveryMode,
      status: section.status,
    },
  });

  const run = (operation: () => Promise<RegistrarActionResult>) =>
    startTransition(async () => {
      setResult(undefined);
      const next = await operation();
      setResult(next);
      if (next.success) router.refresh();
    });

  return (
    <details className="bg-muted/20 mt-4 rounded-sm border">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">
        Manage section
      </summary>
      <form
        className="grid gap-3 border-t p-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={form.handleSubmit((values) =>
          run(() =>
            updateSection({
              institutionId,
              id: section.id,
              ...values,
            }),
          ),
        )}
      >
        <Input
          aria-label="Section capacity"
          type="number"
          {...form.register("capacity", { valueAsNumber: true })}
        />
        <Input aria-label="Section location" {...form.register("location")} />
        <select
          aria-label="Section delivery mode"
          className={selectClass}
          {...form.register("deliveryMode")}
        >
          <option value="in_person">In person</option>
          <option value="online">Online</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <select
          aria-label="Section status"
          className={selectClass}
          {...form.register("status")}
        >
          <option value="planned">Planned</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Save aria-hidden="true" />
            )}
            Save section
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              run(() =>
                deactivateSectionResource({
                  institutionId,
                  id: section.id,
                  resource: "section",
                }),
              )
            }
          >
            <Archive aria-hidden="true" />
            Deactivate
          </Button>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <MutationFeedback result={result} />
        </div>
      </form>
    </details>
  );
}

export function SectionResourceButton({
  institutionId,
  id,
  resource,
}: {
  readonly institutionId: string;
  readonly id: string;
  readonly resource: "instructor" | "meeting";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label={`Remove ${resource}`}
      onClick={() =>
        startTransition(async () => {
          const result = await deactivateSectionResource({
            institutionId,
            id,
            resource,
          });
          if (result.success) router.refresh();
        })
      }
    >
      {pending ? (
        <LoaderCircle className="animate-spin" aria-hidden="true" />
      ) : (
        <Archive aria-hidden="true" />
      )}
    </Button>
  );
}
