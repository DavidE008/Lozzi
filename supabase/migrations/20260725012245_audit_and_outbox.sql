create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  outcome text not null check (outcome in ('success', 'denied', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  correlation_id uuid not null default gen_random_uuid(),
  check (not (metadata ?| array['email', 'name', 'student_number', 'grade', 'gpa']))
);

create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  operation text not null,
  key_hash bytea not null check (octet_length(key_hash) = 32),
  request_commitment bytea not null check (octet_length(request_commitment) = 32),
  result_reference uuid,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (institution_id, operation, key_hash)
);

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  payload jsonb not null,
  idempotency_key uuid not null unique,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  last_error_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (payload ?| array['email', 'name', 'student_number', 'grade', 'gpa']))
);

create index audit_events_recent_idx
  on public.audit_events (institution_id, occurred_at desc);
create index outbox_events_pending_idx
  on public.outbox_events (available_at, created_at)
  where status in ('pending', 'failed');
create index idempotency_keys_lookup_idx
  on public.idempotency_keys (institution_id, operation, expires_at);
