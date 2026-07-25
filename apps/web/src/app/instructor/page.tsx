import { BookOpenCheck, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getInstructorSections } from "@/lib/repositories/grades";

const lifecycleLabel = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  published: "Published",
} as const;

export default async function InstructorSectionsPage() {
  const sections = await getInstructorSections();

  return (
    <>
      <div className="mb-8">
        <p className="text-lozzi-teal text-xs font-semibold tracking-[0.16em] uppercase">
          Instructor workspace
        </p>
        <h1 className="font-heading mt-2 text-4xl font-semibold">
          Assigned sections
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
          Open a section roster to save grades and submit completed outcomes for
          registrar review.
        </p>
      </div>

      {sections.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {sections.map((section) => (
            <Link
              key={section.section_id}
              href={`/instructor/sections/${section.section_id}/grades`}
              className="group"
            >
              <Card className="group-hover:border-lozzi-teal h-full gap-0 rounded-sm py-0 shadow-none transition-colors">
                <CardContent className="flex items-center gap-5 p-6">
                  <div className="border-lozzi-teal/30 bg-lozzi-teal/5 flex size-11 items-center justify-center rounded-sm border">
                    <BookOpenCheck
                      className="text-lozzi-teal size-5"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground text-xs font-medium">
                      {section.term_name} · Section {section.section_code}
                    </p>
                    <h2 className="font-heading mt-1 truncate text-xl font-semibold">
                      {section.course_code} · {section.course_title}
                    </h2>
                    <p className="text-muted-foreground mt-2 text-xs">
                      {section.schedule} · {section.roster_count} roster{" "}
                      {section.roster_count === 1 ? "entry" : "entries"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="rounded-sm text-[10px] font-medium"
                  >
                    {lifecycleLabel[section.lifecycle_state]}
                  </Badge>
                  <ChevronRight
                    className="text-muted-foreground size-5"
                    aria-hidden="true"
                  />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="rounded-sm py-0 shadow-none">
          <CardContent className="p-12 text-center">
            <BookOpenCheck
              className="text-muted-foreground/40 mx-auto size-10"
              aria-hidden="true"
            />
            <p className="mt-4 text-sm font-semibold">No assigned sections</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Registrar assignments will appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
