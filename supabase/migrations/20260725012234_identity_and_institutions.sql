create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 160),
  status text not null default 'active' check (status in ('active', 'inactive')),
  public_commitment bytea,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  check ((status = 'inactive') = (deactivated_at is not null))
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (char_length(display_name) between 2 and 120),
  initials text not null check (char_length(initials) between 1 and 4),
  locale text not null default 'en-GB',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz
);

create table public.institution_memberships (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (
    role in ('student', 'registrar', 'instructor', 'advisor', 'institution_admin')
  ),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (institution_id, user_id, role),
  check ((status = 'inactive') = (deactivated_at is not null))
);

create table public.staff_role_assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (
    role in ('registrar', 'instructor', 'advisor', 'institution_admin')
  ),
  status text not null default 'active' check (status in ('active', 'inactive')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (institution_id, user_id, role),
  check (valid_until is null or valid_until > valid_from)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  student_number text not null,
  pseudonymous_id text not null,
  academic_status text not null default 'active' check (
    academic_status in ('active', 'leave', 'suspended', 'completed', 'withdrawn')
  ),
  expected_completion_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (institution_id, student_number),
  unique (institution_id, pseudonymous_id),
  unique (institution_id, user_id)
);

create table public.student_wallets (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  chain_id bigint not null check (chain_id > 0),
  address bytea not null check (octet_length(address) = 20),
  status text not null default 'pending' check (status in ('pending', 'verified', 'revoked')),
  nonce_hash bytea,
  verified_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chain_id, address),
  check (status <> 'verified' or verified_at is not null),
  check (status <> 'revoked' or revoked_at is not null)
);

create table public.student_verifications (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  provider text not null,
  verification_type text not null,
  provider_subject_hash bytea not null,
  status text not null check (status in ('pending', 'verified', 'failed', 'revoked')),
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, verification_type, provider_subject_hash)
);

create index institution_memberships_user_active_idx
  on public.institution_memberships (user_id, institution_id, role)
  where status = 'active';
create index staff_role_assignments_user_active_idx
  on public.staff_role_assignments (user_id, institution_id, role)
  where status = 'active';
create index students_user_lookup_idx on public.students (user_id, institution_id);
create index student_wallets_student_idx on public.student_wallets (student_id, status);
create index student_verifications_student_idx
  on public.student_verifications (student_id, provider, status);
