create table public.departments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  parent_department_id uuid references public.departments(id) on delete restrict,
  code text not null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (institution_id, code)
);

create table public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  code text not null,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  add_drop_deadline timestamptz,
  status text not null default 'planned' check (
    status in ('planned', 'registration_open', 'in_progress', 'closed')
  ),
  max_credits numeric(5,2) not null default 18 check (max_credits > 0),
  min_credits numeric(5,2) not null default 0 check (min_credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (institution_id, code),
  check (ends_on > starts_on),
  check (registration_closes_at is null or registration_opens_at is null or registration_closes_at > registration_opens_at)
);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  code text not null,
  name text not null,
  credential_type text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (institution_id, code)
);

create table public.program_versions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  program_id uuid not null references public.programs(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  effective_term_id uuid not null references public.academic_terms(id) on delete restrict,
  required_credits numeric(6,2) not null check (required_credits > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (program_id, version_number)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  code text not null,
  title text not null,
  description text,
  credit_hours numeric(5,2) not null check (credit_hours > 0),
  repeat_policy text not null default 'restricted' check (repeat_policy in ('allowed', 'restricted')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (institution_id, code)
);

create table public.program_requirements (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  program_version_id uuid not null references public.program_versions(id) on delete restrict,
  course_id uuid references public.courses(id) on delete restrict,
  requirement_group text not null,
  minimum_credits numeric(6,2) not null default 0 check (minimum_credits >= 0),
  sort_order integer not null default 0,
  rule_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.student_programs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  program_version_id uuid not null references public.program_versions(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'completed', 'withdrawn')),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (student_id, program_version_id)
);

create table public.course_prerequisites (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  prerequisite_course_id uuid not null references public.courses(id) on delete restrict,
  minimum_grade_points numeric(4,2) not null default 2 check (minimum_grade_points between 0 and 4),
  kind text not null default 'prerequisite' check (kind in ('prerequisite', 'corequisite')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, prerequisite_course_id, kind),
  check (course_id <> prerequisite_course_id)
);

create table public.course_sections (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  term_id uuid not null references public.academic_terms(id) on delete restrict,
  section_code text not null,
  capacity integer not null check (capacity > 0),
  enrolled_count integer not null default 0 check (enrolled_count >= 0 and enrolled_count <= capacity),
  location text,
  delivery_mode text not null default 'in_person' check (
    delivery_mode in ('in_person', 'online', 'hybrid')
  ),
  status text not null default 'open' check (status in ('planned', 'open', 'closed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (institution_id, term_id, course_id, section_code)
);

create table public.section_instructors (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  section_id uuid not null references public.course_sections(id) on delete restrict,
  staff_role_assignment_id uuid not null references public.staff_role_assignments(id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, staff_role_assignment_id)
);

create table public.section_meetings (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  section_id uuid not null references public.course_sections(id) on delete restrict,
  weekday smallint not null check (weekday between 1 and 7),
  starts_at time not null,
  ends_at time not null,
  location text,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index departments_institution_idx on public.departments (institution_id, status);
create index academic_terms_institution_idx on public.academic_terms (institution_id, starts_on desc);
create index programs_institution_idx on public.programs (institution_id, department_id, status);
create index program_requirements_version_idx on public.program_requirements (program_version_id, sort_order);
create index courses_institution_idx on public.courses (institution_id, department_id, status);
create index course_prerequisites_course_idx on public.course_prerequisites (course_id, kind);
create index course_sections_term_idx on public.course_sections (institution_id, term_id, status);
create index section_instructors_staff_idx on public.section_instructors (staff_role_assignment_id, section_id);
create index section_meetings_section_idx on public.section_meetings (section_id, weekday, starts_at);
