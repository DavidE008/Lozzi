alter table public.course_prerequisites
  add column deactivated_at timestamptz,
  add column created_by uuid references auth.users(id) on delete restrict,
  add column updated_by uuid references auth.users(id) on delete restrict;

alter table public.program_requirements
  add column deactivated_at timestamptz;

alter table public.section_instructors
  add column deactivated_at timestamptz,
  add column created_by uuid references auth.users(id) on delete restrict,
  add column updated_by uuid references auth.users(id) on delete restrict;

alter table public.section_meetings
  add column deactivated_at timestamptz,
  add column created_by uuid references auth.users(id) on delete restrict,
  add column updated_by uuid references auth.users(id) on delete restrict;

alter table public.academic_terms
  add column withdrawal_deadline timestamptz,
  add column grades_due_at timestamptz,
  add constraint academic_terms_withdrawal_after_add_drop_check
    check (
      withdrawal_deadline is null
      or add_drop_deadline is null
      or withdrawal_deadline > add_drop_deadline
    ),
  add constraint academic_terms_grades_due_after_start_check
    check (
      grades_due_at is null
      or grades_due_at::date >= starts_on
    );

alter table public.departments
  add constraint departments_id_institution_key unique (id, institution_id);
alter table public.academic_terms
  add constraint academic_terms_id_institution_key unique (id, institution_id);
alter table public.programs
  add constraint programs_id_institution_key unique (id, institution_id);
alter table public.program_versions
  add constraint program_versions_id_institution_key unique (id, institution_id);
alter table public.courses
  add constraint courses_id_institution_key unique (id, institution_id);
alter table public.course_sections
  add constraint course_sections_id_institution_key unique (id, institution_id);
alter table public.staff_role_assignments
  add constraint staff_role_assignments_id_institution_key unique (id, institution_id);

alter table public.staff_role_assignments
  add constraint staff_role_assignments_membership_fkey
  foreign key (institution_id, user_id, role)
  references public.institution_memberships (institution_id, user_id, role)
  on delete restrict;

alter table public.departments
  add constraint departments_parent_institution_fkey
  foreign key (parent_department_id, institution_id)
  references public.departments (id, institution_id)
  on delete restrict;

alter table public.programs
  add constraint programs_department_institution_fkey
  foreign key (department_id, institution_id)
  references public.departments (id, institution_id)
  on delete restrict;

alter table public.program_versions
  add constraint program_versions_program_institution_fkey
  foreign key (program_id, institution_id)
  references public.programs (id, institution_id)
  on delete restrict,
  add constraint program_versions_term_institution_fkey
  foreign key (effective_term_id, institution_id)
  references public.academic_terms (id, institution_id)
  on delete restrict;

alter table public.courses
  add constraint courses_department_institution_fkey
  foreign key (department_id, institution_id)
  references public.departments (id, institution_id)
  on delete restrict;

alter table public.program_requirements
  add constraint program_requirements_version_institution_fkey
  foreign key (program_version_id, institution_id)
  references public.program_versions (id, institution_id)
  on delete restrict,
  add constraint program_requirements_course_institution_fkey
  foreign key (course_id, institution_id)
  references public.courses (id, institution_id)
  on delete restrict;

alter table public.course_prerequisites
  add constraint course_prerequisites_course_institution_fkey
  foreign key (course_id, institution_id)
  references public.courses (id, institution_id)
  on delete restrict,
  add constraint course_prerequisites_required_institution_fkey
  foreign key (prerequisite_course_id, institution_id)
  references public.courses (id, institution_id)
  on delete restrict;

alter table public.course_sections
  add constraint course_sections_course_institution_fkey
  foreign key (course_id, institution_id)
  references public.courses (id, institution_id)
  on delete restrict,
  add constraint course_sections_term_institution_fkey
  foreign key (term_id, institution_id)
  references public.academic_terms (id, institution_id)
  on delete restrict;

alter table public.section_instructors
  add constraint section_instructors_section_institution_fkey
  foreign key (section_id, institution_id)
  references public.course_sections (id, institution_id)
  on delete restrict,
  add constraint section_instructors_staff_institution_fkey
  foreign key (staff_role_assignment_id, institution_id)
  references public.staff_role_assignments (id, institution_id)
  on delete restrict;

alter table public.section_meetings
  add constraint section_meetings_section_institution_fkey
  foreign key (section_id, institution_id)
  references public.course_sections (id, institution_id)
  on delete restrict;

alter table public.staff_role_assignments
  add constraint staff_role_assignments_deactivation_check
  check ((status = 'inactive') = (deactivated_at is not null));

alter table public.departments
  add constraint departments_deactivation_check
  check ((status = 'inactive') = (deactivated_at is not null));

alter table public.programs
  add constraint programs_deactivation_check
  check ((status = 'inactive') = (deactivated_at is not null));

alter table public.courses
  add constraint courses_deactivation_check
  check ((status = 'inactive') = (deactivated_at is not null));

create index departments_parent_institution_idx
  on public.departments (parent_department_id, institution_id)
  where parent_department_id is not null;
create index programs_department_institution_idx
  on public.programs (department_id, institution_id);
create index program_versions_program_institution_idx
  on public.program_versions (program_id, institution_id);
create index program_versions_term_institution_idx
  on public.program_versions (effective_term_id, institution_id);
create index program_requirements_version_institution_idx
  on public.program_requirements (program_version_id, institution_id);
create index program_requirements_course_institution_idx
  on public.program_requirements (course_id, institution_id)
  where course_id is not null;
create index courses_department_institution_idx
  on public.courses (department_id, institution_id);
create index course_prerequisites_course_institution_idx
  on public.course_prerequisites (course_id, institution_id);
create index course_prerequisites_required_institution_idx
  on public.course_prerequisites (prerequisite_course_id, institution_id);
create index course_sections_course_institution_idx
  on public.course_sections (course_id, institution_id);
create index course_sections_term_institution_idx
  on public.course_sections (term_id, institution_id);
create index section_instructors_section_institution_idx
  on public.section_instructors (section_id, institution_id);
create index section_instructors_staff_institution_idx
  on public.section_instructors (staff_role_assignment_id, institution_id);
create index section_meetings_section_institution_idx
  on public.section_meetings (section_id, institution_id);
create index program_requirements_active_idx
  on public.program_requirements (institution_id, program_version_id, sort_order)
  where deactivated_at is null;
create index course_prerequisites_active_idx
  on public.course_prerequisites (institution_id, course_id, kind)
  where deactivated_at is null;
create index section_instructors_active_idx
  on public.section_instructors (institution_id, section_id, is_primary)
  where deactivated_at is null;
create index section_meetings_active_idx
  on public.section_meetings (institution_id, section_id, weekday, starts_at)
  where deactivated_at is null;
