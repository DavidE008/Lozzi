import { CalendarRange, MapPin, UserRound } from "lucide-react";
import { redirect } from "next/navigation";

import { RegistrarPageHeading } from "@/components/registrar/page-heading";
import {
  SectionControls,
  SectionManager,
  SectionResourceButton,
} from "@/components/registrar/section-manager";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getRegistrarCatalog,
  getRegistrarSectionResources,
  getRegistrarStaff,
  getRegistrarTerms,
} from "@/lib/repositories/registrar-administration";
import {
  getRegistrarSections,
  getRegistrarWorkspaceForUser,
} from "@/lib/repositories/registrar";

const weekday = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function RegistrarSectionsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  const workspace = await getRegistrarWorkspaceForUser(user.id);
  if (!workspace) redirect("/onboarding");
  const [sections, catalog, terms, staff, resources] = await Promise.all([
    getRegistrarSections(workspace.institutionId),
    getRegistrarCatalog(workspace.institutionId),
    getRegistrarTerms(workspace.institutionId),
    getRegistrarStaff(workspace.institutionId),
    getRegistrarSectionResources(workspace.institutionId),
  ]);

  return (
    <>
      <RegistrarPageHeading
        eyebrow="Teaching schedule"
        title="Sections"
        description="Manage course offerings, delivery details, instructor assignments, and meeting patterns."
      />
      <SectionManager
        institutionId={workspace.institutionId}
        catalog={catalog}
        terms={terms}
        staff={staff}
        sections={sections.map((section) => ({
          id: section.id,
          label: `${section.courseCode} · ${section.sectionCode} · ${section.termName}`,
        }))}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        {sections.map((section) => {
          const instructors = resources.instructors.filter(
            (item) => item.sectionId === section.id,
          );
          const meetings = resources.meetings.filter(
            (item) => item.sectionId === section.id,
          );
          return (
            <Card key={section.id} className="shadow-none">
              <CardContent>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lozzi-teal text-xs font-semibold tracking-wider uppercase">
                        {section.courseCode} · {section.sectionCode}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize"
                      >
                        {section.status}
                      </Badge>
                    </div>
                    <h2 className="font-heading mt-2 text-xl font-semibold">
                      {section.courseTitle}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {section.termName} · {section.enrolledCount}/
                      {section.capacity} enrolled
                    </p>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {section.deliveryMode.replace("_", " ")}
                  </Badge>
                </div>

                <div className="mt-5 grid gap-4 border-t pt-4 sm:grid-cols-2">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-semibold">
                      <UserRound
                        className="text-lozzi-teal size-3.5"
                        aria-hidden="true"
                      />
                      Instructors
                    </p>
                    <ul className="mt-2 space-y-1">
                      {instructors.map((item) => (
                        <li
                          key={item.id}
                          className="text-muted-foreground flex items-center justify-between text-xs"
                        >
                          <span>
                            {item.displayName}
                            {item.isPrimary ? " · Primary" : ""}
                          </span>
                          <SectionResourceButton
                            institutionId={workspace.institutionId}
                            id={item.id}
                            resource="instructor"
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="flex items-center gap-2 text-xs font-semibold">
                      <CalendarRange
                        className="text-lozzi-teal size-3.5"
                        aria-hidden="true"
                      />
                      Meetings
                    </p>
                    <ul className="mt-2 space-y-1">
                      {meetings.map((item) => (
                        <li
                          key={item.id}
                          className="text-muted-foreground flex items-center justify-between text-xs"
                        >
                          <span>
                            {weekday[item.weekday]} {item.startsAt.slice(0, 5)}–
                            {item.endsAt.slice(0, 5)}
                          </span>
                          <SectionResourceButton
                            institutionId={workspace.institutionId}
                            id={item.id}
                            resource="meeting"
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="text-muted-foreground mt-4 flex items-center gap-2 text-xs">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {section.location ?? "Location to be announced"}
                </p>
                <SectionControls
                  institutionId={workspace.institutionId}
                  section={section}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
