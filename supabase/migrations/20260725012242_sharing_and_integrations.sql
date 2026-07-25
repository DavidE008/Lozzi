create table public.record_share_grants (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  academic_record_version_id uuid not null references public.academic_record_versions(id) on delete restrict,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  grant_commitment bytea not null check (octet_length(grant_commitment) = 32),
  recipient_label text not null,
  scopes text[] not null check (cardinality(scopes) > 0),
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  check (expires_at > created_at),
  check (status <> 'revoked' or revoked_at is not null)
);

create table public.record_share_access_logs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  share_grant_id uuid not null references public.record_share_grants(id) on delete restrict,
  access_result text not null check (access_result in ('allowed', 'denied_expired', 'denied_revoked', 'denied_scope', 'denied_invalid')),
  requested_scopes text[] not null default '{}',
  occurred_at timestamptz not null default now(),
  request_fingerprint_hash bytea
);

create table public.ens_identities (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid references public.students(id) on delete restrict,
  name_hash bytea not null check (octet_length(name_hash) = 32),
  public_name text,
  network text not null default 'ethereum-sepolia',
  status text not null default 'not_configured' check (
    status in ('not_configured', 'pending', 'active', 'failed', 'revoked')
  ),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (network, name_hash)
);

create table public.world_verifications (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  action_id text not null,
  nullifier_hash bytea not null,
  signal_hash bytea not null,
  credential_type text not null,
  status text not null check (status in ('pending', 'verified', 'failed', 'revoked')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (action_id, nullifier_hash)
);

create table public.zero_g_objects (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  owner_student_id uuid references public.students(id) on delete restrict,
  object_type text not null,
  root_hash bytea not null check (octet_length(root_hash) = 32),
  encryption_mode text not null check (encryption_mode in ('aes-256-gcm', 'ecies')),
  wrapping_key_reference text not null,
  status text not null default 'not_configured' check (
    status in ('not_configured', 'pending', 'available', 'failed', 'revoked')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (root_hash)
);

create table public.ai_inference_runs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  provider text not null,
  model text not null,
  verification_mode text not null,
  request_commitment bytea not null check (octet_length(request_commitment) = 32),
  response_commitment bytea check (response_commitment is null or octet_length(response_commitment) = 32),
  schema_validation_status text not null check (
    schema_validation_status in ('pending', 'valid', 'invalid', 'failed')
  ),
  human_review_status text not null default 'not_reviewed' check (
    human_review_status in ('not_reviewed', 'approved', 'rejected')
  ),
  error_category text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.blockchain_anchors (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  academic_record_version_id uuid references public.academic_record_versions(id) on delete restrict,
  record_type text not null,
  chain_id bigint not null check (chain_id > 0),
  contract_address bytea check (contract_address is null or octet_length(contract_address) = 20),
  transaction_hash bytea check (transaction_hash is null or octet_length(transaction_hash) = 32),
  commitment bytea not null check (octet_length(commitment) = 32),
  status text not null default 'not_configured' check (
    status in ('not_configured', 'pending', 'confirmed', 'failed')
  ),
  retry_count integer not null default 0 check (retry_count >= 0),
  error_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table public.integration_capabilities (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  provider text not null check (provider in ('world', 'world-chain', 'ens', 'zero-g', 'walletconnect')),
  state text not null check (state in ('available', 'mock-development', 'not-configured', 'failed')),
  detail text not null,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, provider)
);

create index record_share_grants_active_idx
  on public.record_share_grants (student_id, expires_at)
  where status = 'active';
create index record_share_access_logs_grant_idx
  on public.record_share_access_logs (share_grant_id, occurred_at desc);
create index zero_g_objects_owner_idx on public.zero_g_objects (owner_student_id, status);
create index ai_inference_runs_student_idx on public.ai_inference_runs (student_id, created_at desc);
create index blockchain_anchors_failed_idx
  on public.blockchain_anchors (institution_id, retry_count, updated_at)
  where status = 'failed';
