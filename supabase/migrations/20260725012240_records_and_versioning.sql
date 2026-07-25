create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  section_id uuid not null references public.course_sections(id) on delete restrict,
  status text not null default 'enrolled' check (
    status in ('pending', 'enrolled', 'waitlisted', 'withdrawn', 'completed', 'dropped')
  ),
  credit_hours numeric(5,2) not null check (credit_hours > 0),
  enrolled_at timestamptz,
  withdrawn_at timestamptz,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (student_id, section_id),
  unique (institution_id, idempotency_key)
);

create table public.grade_submissions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  state text not null default 'draft' check (state in ('draft', 'submitted', 'approved', 'published')),
  grade_code text not null,
  grade_points numeric(4,2) check (grade_points between 0 and 4),
  correction_reason_code text,
  submitted_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.grade_records (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  grade_submission_id uuid not null references public.grade_submissions(id) on delete restrict,
  previous_grade_record_id uuid references public.grade_records(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  grade_code text not null,
  grade_points numeric(4,2) check (grade_points between 0 and 4),
  credit_hours_earned numeric(5,2) not null default 0 check (credit_hours_earned >= 0),
  is_current boolean not null default true,
  published_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  unique (enrollment_id, version_number)
);

create unique index grade_records_one_current_idx
  on public.grade_records (enrollment_id)
  where is_current;

create table public.academic_record_versions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  previous_version_id uuid references public.academic_record_versions(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  content_commitment bytea not null check (octet_length(content_commitment) = 32),
  salt_reference text not null,
  status text not null default 'pending' check (status in ('pending', 'published', 'superseded', 'failed')),
  anchor_status text not null default 'not_configured' check (
    anchor_status in ('not_configured', 'pending', 'confirmed', 'failed')
  ),
  correction_reason_code text,
  is_current boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  unique (student_id, version_number)
);

create unique index academic_record_versions_one_current_idx
  on public.academic_record_versions (student_id)
  where is_current;

create table public.record_documents (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  academic_record_version_id uuid not null references public.academic_record_versions(id) on delete restrict,
  object_type text not null,
  storage_provider text not null,
  object_reference text not null,
  ciphertext_sha256 bytea not null check (octet_length(ciphertext_sha256) = 32),
  encryption_mode text not null check (encryption_mode in ('aes-256-gcm', 'ecies')),
  wrapping_key_reference text not null,
  status text not null default 'available' check (status in ('pending', 'available', 'failed', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table public.degree_audit_snapshots (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  student_program_id uuid not null references public.student_programs(id) on delete restrict,
  academic_record_version_id uuid not null references public.academic_record_versions(id) on delete restrict,
  credits_earned numeric(6,2) not null check (credits_earned >= 0),
  credits_required numeric(6,2) not null check (credits_required > 0),
  gpa numeric(4,2) check (gpa between 0 and 4),
  progress_percent numeric(5,2) not null check (progress_percent between 0 and 100),
  requirement_results jsonb not null default '[]'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table public.advisor_assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  advisor_role_assignment_id uuid not null references public.staff_role_assignments(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'inactive')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (student_id, advisor_role_assignment_id),
  check (ends_at is null or ends_at > starts_at)
);

create table public.advisor_notes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  advisor_role_assignment_id uuid not null references public.staff_role_assignments(id) on delete restrict,
  note_ciphertext bytea not null,
  encryption_reference text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz
);

create table public.student_holds (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  hold_type text not null,
  reason_code text not null,
  is_blocking boolean not null default true,
  status text not null default 'active' check (status in ('active', 'released')),
  placed_at timestamptz not null default now(),
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  check (status <> 'released' or released_at is not null)
);

create index enrollments_student_active_idx
  on public.enrollments (student_id, status)
  where status in ('pending', 'enrolled', 'waitlisted');
create index enrollments_section_roster_idx
  on public.enrollments (section_id, status, student_id)
  where status in ('enrolled', 'completed');
create index grade_submissions_enrollment_idx on public.grade_submissions (enrollment_id, state);
create index academic_record_versions_student_idx
  on public.academic_record_versions (student_id, version_number desc);
create index record_documents_record_idx on public.record_documents (academic_record_version_id, status);
create index degree_audit_student_idx on public.degree_audit_snapshots (student_id, calculated_at desc);
create index advisor_assignments_advisor_idx
  on public.advisor_assignments (advisor_role_assignment_id, status, student_id);
create index student_holds_active_idx
  on public.student_holds (student_id, is_blocking)
  where status = 'active';
