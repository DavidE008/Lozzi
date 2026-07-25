-- These foreign keys appeared inside wider indexes but were not leading columns.
-- Dedicated indexes keep referential checks efficient.
create index if not exists course_prerequisites_prerequisite_course_idx
  on public.course_prerequisites (prerequisite_course_id);
create index if not exists course_sections_course_idx
  on public.course_sections (course_id);
create index if not exists course_sections_term_fk_idx
  on public.course_sections (term_id);
create index if not exists courses_department_idx
  on public.courses (department_id);
create index if not exists programs_department_idx
  on public.programs (department_id);
create index if not exists student_programs_program_version_idx
  on public.student_programs (program_version_id);
