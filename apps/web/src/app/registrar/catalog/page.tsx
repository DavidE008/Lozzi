import { BookOpen, Boxes, GraduationCap } from "lucide-react";
import { redirect } from "next/navigation";

import { CatalogManager } from "@/components/registrar/catalog-manager";
import { CatalogResourceButton } from "@/components/registrar/catalog-resource-button";
import { RegistrarPageHeading } from "@/components/registrar/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getRegistrarCatalog,
  getRegistrarTerms,
} from "@/lib/repositories/registrar-administration";
import { getRegistrarWorkspaceForUser } from "@/lib/repositories/registrar";

export default async function RegistrarCatalogPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  const workspace = await getRegistrarWorkspaceForUser(user.id);
  if (!workspace) redirect("/onboarding");
  const [catalog, terms] = await Promise.all([
    getRegistrarCatalog(workspace.institutionId),
    getRegistrarTerms(workspace.institutionId),
  ]);

  return (
    <>
      <RegistrarPageHeading
        eyebrow="Academic structure"
        title="Catalog"
        description="Manage departments, programmes, requirements, courses, and prerequisite rules within Northstar University's tenant boundary."
      />

      <section
        aria-label="Catalog summary"
        className="bg-border mb-7 grid overflow-hidden rounded-sm border sm:grid-cols-3"
      >
        {[
          {
            label: "Departments",
            value: catalog.departments.length,
            icon: Boxes,
          },
          {
            label: "Programmes",
            value: catalog.programs.length,
            icon: GraduationCap,
          },
          {
            label: "Courses",
            value: catalog.courses.length,
            icon: BookOpen,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="bg-card flex items-center justify-between border-b px-5 py-4 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0"
          >
            <div>
              <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                {label}
              </p>
              <p className="font-heading mt-1 text-2xl font-semibold">
                {value}
              </p>
            </div>
            <Icon className="text-lozzi-teal size-5" aria-hidden="true" />
          </div>
        ))}
      </section>

      <CatalogManager
        institutionId={workspace.institutionId}
        catalog={catalog}
        terms={terms}
      />

      <div className="mt-7 grid gap-7 xl:grid-cols-2">
        <Card className="gap-0 overflow-hidden py-0 shadow-none">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="font-heading text-xl">
              Departments and courses
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="bg-muted/20 border-b px-5 py-3">
              {catalog.departments.map((department) => (
                <li
                  key={department.id}
                  className="flex items-center justify-between gap-3 py-1.5"
                >
                  <span className="text-xs font-medium">
                    {department.code} · {department.name}
                  </span>
                  <CatalogResourceButton
                    institutionId={workspace.institutionId}
                    id={department.id}
                    resource="department"
                  />
                </li>
              ))}
            </ul>
            <ul className="divide-y">
              {catalog.courses.map((course) => (
                <li
                  key={course.id}
                  className="flex items-start justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lozzi-teal text-xs font-semibold tracking-wider uppercase">
                        {course.code}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {course.departmentCode}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm font-semibold">{course.title}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {course.creditHours} credits · {course.status}
                    </p>
                  </div>
                  <CatalogResourceButton
                    institutionId={workspace.institutionId}
                    id={course.id}
                    resource="course"
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="gap-0 overflow-hidden py-0 shadow-none">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="font-heading text-xl">
              Programmes and requirements
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="bg-muted/20 border-b px-5 py-3">
              {catalog.programs.map((program) => (
                <li
                  key={program.id}
                  className="flex items-center justify-between gap-3 py-1.5"
                >
                  <span className="text-xs font-medium">
                    {program.code} · {program.name}
                  </span>
                  <CatalogResourceButton
                    institutionId={workspace.institutionId}
                    id={program.id}
                    resource="program"
                  />
                </li>
              ))}
            </ul>
            <ul className="divide-y">
              {catalog.programVersions.map((version) => (
                <li key={version.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">
                        {version.programName} · Version {version.versionNumber}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {version.requiredCredits} credits · {version.status}
                      </p>
                    </div>
                    <CatalogResourceButton
                      institutionId={workspace.institutionId}
                      id={version.id}
                      resource="program_version"
                    />
                  </div>
                  <ul className="mt-3 space-y-2 border-t pt-3">
                    {catalog.requirements
                      .filter(
                        (requirement) =>
                          requirement.programVersionId === version.id,
                      )
                      .map((requirement) => (
                        <li
                          key={requirement.id}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="text-muted-foreground">
                            {requirement.requirementGroup} ·{" "}
                            {requirement.courseCode ??
                              `${requirement.minimumCredits} credits`}
                          </span>
                          <CatalogResourceButton
                            institutionId={workspace.institutionId}
                            id={requirement.id}
                            resource="requirement"
                          />
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-7 gap-0 overflow-hidden py-0 shadow-none">
        <CardHeader className="border-b px-5 py-4">
          <CardTitle className="font-heading text-xl">
            Prerequisite rules
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {catalog.prerequisites.length ? (
            <ul className="divide-y">
              {catalog.prerequisites.map((rule) => (
                <li
                  key={rule.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {rule.courseCode} requires {rule.prerequisiteCourseCode}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs capitalize">
                      {rule.kind} · Minimum {rule.minimumGradePoints.toFixed(1)}{" "}
                      grade points
                    </p>
                  </div>
                  <CatalogResourceButton
                    institutionId={workspace.institutionId}
                    id={rule.id}
                    resource="prerequisite"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground px-5 py-10 text-center text-sm">
              No prerequisite rules have been configured.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
