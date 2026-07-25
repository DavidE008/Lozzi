create index if not exists course_prerequisites_created_by_idx
  on public.course_prerequisites (created_by);

create index if not exists course_prerequisites_updated_by_idx
  on public.course_prerequisites (updated_by);

create index if not exists section_instructors_created_by_idx
  on public.section_instructors (created_by);

create index if not exists section_instructors_updated_by_idx
  on public.section_instructors (updated_by);

create index if not exists section_meetings_created_by_idx
  on public.section_meetings (created_by);

create index if not exists section_meetings_updated_by_idx
  on public.section_meetings (updated_by);
