"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  createCourse,
  createDepartment,
  createPrerequisite,
  createProgram,
  createProgramVersion,
  createRequirement,
} from "@/app/registrar/catalog/actions";
import { MutationFeedback } from "@/components/registrar/mutation-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RegistrarActionResult } from "@/lib/registrar/mutation-context";
import type {
  RegistrarCatalog,
  RegistrarTerm,
} from "@/lib/repositories/registrar-administration";

const selectClass =
  "border-input bg-background h-9 w-full rounded-sm border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20";
const code = z.string().trim().min(2).max(24);
const name = z.string().trim().min(2).max(160);

const departmentSchema = z.object({
  code,
  name,
  parentDepartmentId: z.string().optional(),
});
const courseSchema = z.object({
  departmentId: z.string().min(1),
  code,
  title: name,
  description: z.string().max(1200).optional(),
  creditHours: z.number().positive().max(30),
});
const programSchema = z.object({
  departmentId: z.string().min(1),
  code,
  name,
  credentialType: z.string().trim().min(2).max(80),
});
const versionSchema = z.object({
  programId: z.string().min(1),
  effectiveTermId: z.string().min(1),
  versionNumber: z.number().int().positive(),
  requiredCredits: z.number().positive(),
});
const requirementSchema = z.object({
  programVersionId: z.string().min(1),
  courseId: z.string().optional(),
  requirementGroup: z.string().trim().min(2).max(100),
  minimumCredits: z.number().min(0),
  sortOrder: z.number().int().min(0),
});
const prerequisiteSchema = z
  .object({
    courseId: z.string().min(1),
    prerequisiteCourseId: z.string().min(1),
    minimumGradePoints: z.number().min(0).max(4),
    kind: z.enum(["prerequisite", "corequisite"]),
  })
  .refine((value) => value.courseId !== value.prerequisiteCourseId, {
    message: "Choose a different prerequisite course.",
    path: ["prerequisiteCourseId"],
  });

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? (
        <LoaderCircle className="animate-spin" aria-hidden="true" />
      ) : (
        <Plus aria-hidden="true" />
      )}
      {pending ? "Saving…" : label}
    </Button>
  );
}

function FormError({ message }: { readonly message?: string }) {
  return message ? <p className="text-destructive text-xs">{message}</p> : null;
}

export function CatalogManager({
  institutionId,
  catalog,
  terms,
}: {
  readonly institutionId: string;
  readonly catalog: RegistrarCatalog;
  readonly terms: readonly RegistrarTerm[];
}) {
  const router = useRouter();
  const [result, setResult] = useState<RegistrarActionResult>();
  const [pending, startTransition] = useTransition();

  const run = (
    operation: () => Promise<RegistrarActionResult>,
    reset: () => void,
  ) => {
    setResult(undefined);
    startTransition(async () => {
      const next = await operation();
      setResult(next);
      if (next.success) {
        reset();
        router.refresh();
      }
    });
  };

  const department = useForm<z.infer<typeof departmentSchema>>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { code: "", name: "", parentDepartmentId: "" },
  });
  const course = useForm<z.infer<typeof courseSchema>>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      departmentId: catalog.departments[0]?.id ?? "",
      code: "",
      title: "",
      description: "",
      creditHours: 3,
    },
  });
  const program = useForm<z.infer<typeof programSchema>>({
    resolver: zodResolver(programSchema),
    defaultValues: {
      departmentId: catalog.departments[0]?.id ?? "",
      code: "",
      name: "",
      credentialType: "Bachelor of Science",
    },
  });
  const version = useForm<z.infer<typeof versionSchema>>({
    resolver: zodResolver(versionSchema),
    defaultValues: {
      programId: catalog.programs[0]?.id ?? "",
      effectiveTermId: terms[0]?.id ?? "",
      versionNumber: 1,
      requiredCredits: 120,
    },
  });
  const requirement = useForm<z.infer<typeof requirementSchema>>({
    resolver: zodResolver(requirementSchema),
    defaultValues: {
      programVersionId: catalog.programVersions[0]?.id ?? "",
      courseId: "",
      requirementGroup: "Major core",
      minimumCredits: 3,
      sortOrder: catalog.requirements.length + 1,
    },
  });
  const prerequisite = useForm<z.infer<typeof prerequisiteSchema>>({
    resolver: zodResolver(prerequisiteSchema),
    defaultValues: {
      courseId: catalog.courses[0]?.id ?? "",
      prerequisiteCourseId: catalog.courses[1]?.id ?? "",
      minimumGradePoints: 2,
      kind: "prerequisite",
    },
  });

  return (
    <div className="space-y-3">
      <MutationFeedback result={result} />

      <details className="bg-card rounded-sm border" open>
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
          Add department or course
        </summary>
        <div className="grid gap-6 border-t p-4 lg:grid-cols-2">
          <form
            className="space-y-3"
            onSubmit={department.handleSubmit((values) =>
              run(
                () =>
                  createDepartment({
                    institutionId,
                    ...values,
                    parentDepartmentId: values.parentDepartmentId || undefined,
                  }),
                () => department.reset(),
              ),
            )}
          >
            <p className="text-lozzi-slate text-xs font-semibold tracking-wider uppercase">
              Department
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="department-code">Code</Label>
                <Input id="department-code" {...department.register("code")} />
                <FormError
                  message={department.formState.errors.code?.message}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="department-name">Name</Label>
                <Input id="department-name" {...department.register("name")} />
                <FormError
                  message={department.formState.errors.name?.message}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parent-department">Parent department</Label>
              <select
                id="parent-department"
                className={selectClass}
                {...department.register("parentDepartmentId")}
              >
                <option value="">None</option>
                {catalog.departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </div>
            <SubmitButton pending={pending} label="Add department" />
          </form>

          <form
            className="space-y-3"
            onSubmit={course.handleSubmit((values) =>
              run(
                () => createCourse({ institutionId, ...values }),
                () => course.reset(),
              ),
            )}
          >
            <p className="text-lozzi-slate text-xs font-semibold tracking-wider uppercase">
              Course
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="course-department">Department</Label>
              <select
                id="course-department"
                className={selectClass}
                {...course.register("departmentId")}
              >
                {catalog.departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-[0.65fr_1.35fr]">
              <div className="space-y-1.5">
                <Label htmlFor="course-code">Code</Label>
                <Input id="course-code" {...course.register("code")} />
                <FormError message={course.formState.errors.code?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="course-title">Title</Label>
                <Input id="course-title" {...course.register("title")} />
                <FormError message={course.formState.errors.title?.message} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-description">Description</Label>
              <Input
                id="course-description"
                {...course.register("description")}
              />
            </div>
            <div className="w-36 space-y-1.5">
              <Label htmlFor="course-credits">Credits</Label>
              <Input
                id="course-credits"
                type="number"
                step="0.5"
                {...course.register("creditHours", { valueAsNumber: true })}
              />
            </div>
            <SubmitButton pending={pending} label="Add course" />
          </form>
        </div>
      </details>

      <details className="bg-card rounded-sm border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
          Add programme structure
        </summary>
        <div className="grid gap-7 border-t p-4 xl:grid-cols-2">
          <form
            className="space-y-3"
            onSubmit={program.handleSubmit((values) =>
              run(
                () => createProgram({ institutionId, ...values }),
                () => program.reset(),
              ),
            )}
          >
            <p className="text-lozzi-slate text-xs font-semibold tracking-wider uppercase">
              Programme
            </p>
            <select
              aria-label="Programme department"
              className={selectClass}
              {...program.register("departmentId")}
            >
              {catalog.departments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.name}
                </option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                aria-label="Programme code"
                {...program.register("code")}
              />
              <Input
                aria-label="Programme name"
                {...program.register("name")}
              />
            </div>
            <Input
              aria-label="Credential type"
              {...program.register("credentialType")}
            />
            <SubmitButton pending={pending} label="Add programme" />
          </form>

          <form
            className="space-y-3"
            onSubmit={version.handleSubmit((values) =>
              run(
                () => createProgramVersion({ institutionId, ...values }),
                () => version.reset(),
              ),
            )}
          >
            <p className="text-lozzi-slate text-xs font-semibold tracking-wider uppercase">
              Programme version
            </p>
            <select
              aria-label="Programme"
              className={selectClass}
              {...version.register("programId")}
            >
              {catalog.programs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Effective term"
              className={selectClass}
              {...version.register("effectiveTermId")}
            >
              {terms.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                aria-label="Version number"
                type="number"
                {...version.register("versionNumber", { valueAsNumber: true })}
              />
              <Input
                aria-label="Required credits"
                type="number"
                step="0.5"
                {...version.register("requiredCredits", {
                  valueAsNumber: true,
                })}
              />
            </div>
            <SubmitButton pending={pending} label="Add draft version" />
          </form>

          <form
            className="space-y-3"
            onSubmit={requirement.handleSubmit((values) =>
              run(
                () =>
                  createRequirement({
                    institutionId,
                    ...values,
                    courseId: values.courseId || undefined,
                  }),
                () => requirement.reset(),
              ),
            )}
          >
            <p className="text-lozzi-slate text-xs font-semibold tracking-wider uppercase">
              Requirement
            </p>
            <select
              aria-label="Programme version"
              className={selectClass}
              {...requirement.register("programVersionId")}
            >
              {catalog.programVersions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.programName} · v{item.versionNumber}
                </option>
              ))}
            </select>
            <select
              aria-label="Required course"
              className={selectClass}
              {...requirement.register("courseId")}
            >
              <option value="">Credit group only</option>
              {catalog.courses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.title}
                </option>
              ))}
            </select>
            <Input
              aria-label="Requirement group"
              {...requirement.register("requirementGroup")}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                aria-label="Minimum credits"
                type="number"
                step="0.5"
                {...requirement.register("minimumCredits", {
                  valueAsNumber: true,
                })}
              />
              <Input
                aria-label="Sort order"
                type="number"
                {...requirement.register("sortOrder", { valueAsNumber: true })}
              />
            </div>
            <SubmitButton pending={pending} label="Add requirement" />
          </form>

          <form
            className="space-y-3"
            onSubmit={prerequisite.handleSubmit((values) =>
              run(
                () => createPrerequisite({ institutionId, ...values }),
                () => prerequisite.reset(),
              ),
            )}
          >
            <p className="text-lozzi-slate text-xs font-semibold tracking-wider uppercase">
              Prerequisite rule
            </p>
            <select
              aria-label="Target course"
              className={selectClass}
              {...prerequisite.register("courseId")}
            >
              {catalog.courses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.title}
                </option>
              ))}
            </select>
            <select
              aria-label="Prerequisite course"
              className={selectClass}
              {...prerequisite.register("prerequisiteCourseId")}
            >
              {catalog.courses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.title}
                </option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                aria-label="Rule kind"
                className={selectClass}
                {...prerequisite.register("kind")}
              >
                <option value="prerequisite">Prerequisite</option>
                <option value="corequisite">Corequisite</option>
              </select>
              <Input
                aria-label="Minimum grade points"
                type="number"
                min="0"
                max="4"
                step="0.1"
                {...prerequisite.register("minimumGradePoints", {
                  valueAsNumber: true,
                })}
              />
            </div>
            <FormError
              message={
                prerequisite.formState.errors.prerequisiteCourseId?.message
              }
            />
            <SubmitButton pending={pending} label="Add rule" />
          </form>
        </div>
      </details>
    </div>
  );
}
