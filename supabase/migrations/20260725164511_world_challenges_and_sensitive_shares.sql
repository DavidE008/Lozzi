create table public.record_share_drafts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  academic_record_version_id uuid not null references public.academic_record_versions(id) on delete restrict,
  recipient_label text not null check (char_length(recipient_label) between 1 and 120),
  scopes text[] not null check (
    cardinality(scopes) between 1 and 8
    and scopes <@ array['program', 'degree-progress', 'record-summary', 'full-record']::text[]
  ),
  status text not null default 'draft' check (
    status in (
      'draft',
      'adult_attested',
      'ready',
      'active',
      'assisted_consent_required',
      'expired',
      'cancelled'
    )
  ),
  draft_expires_at timestamptz not null,
  grant_expires_at timestamptz not null,
  adult_attested_at timestamptz,
  liveness_verified_at timestamptz,
  assisted_consent_requested_at timestamptz,
  activated_at timestamptz,
  record_share_grant_id uuid unique references public.record_share_grants(id) on delete restrict,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  check (draft_expires_at > created_at),
  check (draft_expires_at <= created_at + interval '30 minutes'),
  check (grant_expires_at > created_at),
  check (grant_expires_at <= created_at + interval '30 days'),
  check (status <> 'adult_attested' or adult_attested_at is not null),
  check (
    status not in ('ready', 'active')
    or (
      adult_attested_at is not null
      and liveness_verified_at is not null
    )
  ),
  check (
    status <> 'assisted_consent_required'
    or assisted_consent_requested_at is not null
  ),
  check (
    status <> 'active'
    or (
      activated_at is not null
      and record_share_grant_id is not null
    )
  )
);

create index record_share_drafts_student_status_idx
  on public.record_share_drafts (student_id, status, created_at desc);
create index record_share_drafts_expiry_idx
  on public.record_share_drafts (draft_expires_at)
  where status in ('draft', 'adult_attested', 'ready');

create table public.world_proof_challenges (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  purpose text not null check (
    purpose in ('account-humanity', 'share-liveness', 'adult-share-consent')
  ),
  subject_id uuid references public.record_share_drafts(id) on delete restrict,
  action_id text not null,
  environment text not null check (
    environment in ('production', 'sandbox', 'staging')
  ),
  nonce bytea not null unique check (octet_length(nonce) = 32),
  expected_signal_hash bytea check (
    expected_signal_hash is null
    or octet_length(expected_signal_hash) = 32
  ),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (expires_at <= created_at + interval '10 minutes'),
  check (
    (
      purpose = 'account-humanity'
      and subject_id is null
      and action_id = 'lozzi-student-verification'
    )
    or (
      purpose = 'share-liveness'
      and subject_id is not null
      and action_id = 'lozzi-sensitive-share-selfie-check'
    )
    or (
      purpose = 'adult-share-consent'
      and subject_id is not null
      and action_id = 'lozzi-adult-share-consent'
    )
  )
);

create index world_proof_challenges_student_recent_idx
  on public.world_proof_challenges (student_id, created_at desc);
create index world_proof_challenges_expiry_idx
  on public.world_proof_challenges (expires_at)
  where consumed_at is null;

alter table public.world_verifications
  add column purpose text not null default 'account-humanity',
  add column subject_id uuid references public.record_share_drafts(id) on delete restrict,
  add column challenge_id uuid unique references public.world_proof_challenges(id) on delete restrict,
  add column identity_attested boolean not null default false,
  add column presence_status text not null default 'not-requested';

update public.world_verifications
set protocol_version = '4.0'
where protocol_version = 'world-id-v4';

alter table public.world_verifications
  alter column signal_hash drop not null,
  alter column protocol_version set default '4.0',
  drop constraint if exists world_verifications_credential_type_check,
  drop constraint if exists world_verifications_verified_state_check,
  add constraint world_verifications_purpose_check
  check (
    purpose in ('account-humanity', 'share-liveness', 'adult-share-consent')
  ),
  add constraint world_verifications_protocol_version_check
  check (protocol_version in ('3.0', '4.0')),
  add constraint world_verifications_presence_status_check
  check (presence_status in ('completed', 'not-requested')),
  add constraint world_verifications_purpose_action_check
  check (
    (
      purpose = 'account-humanity'
      and subject_id is null
      and action_id = 'lozzi-student-verification'
    )
    or (
      purpose = 'share-liveness'
      and subject_id is not null
      and action_id = 'lozzi-sensitive-share-selfie-check'
    )
    or (
      purpose = 'adult-share-consent'
      and subject_id is not null
      and action_id = 'lozzi-adult-share-consent'
    )
  ),
  add constraint world_verifications_credential_type_check
  check (
    (
      purpose = 'account-humanity'
      and credential_type in ('proof_of_human', 'orb')
    )
    or (
      purpose = 'share-liveness'
      and credential_type = 'selfie'
      and protocol_version = '3.0'
    )
    or (
      purpose = 'adult-share-consent'
      and credential_type in ('passport', 'mnc')
      and protocol_version = '4.0'
      and identity_attested
    )
  ),
  add constraint world_verifications_verified_state_check
  check (
    status <> 'verified'
    or (
      nullifier is not null
      and verified_at is not null
      and (
        signal_hash is null
        or octet_length(signal_hash) = 32
      )
      and (
        purpose = 'adult-share-consent'
        or octet_length(signal_hash) = 32
      )
    )
  );

alter table public.world_verifications
  drop constraint if exists world_verifications_action_id_nullifier_hash_key;
drop index if exists public.world_verifications_action_nullifier_idx;
create unique index world_verifications_account_nullifier_idx
  on public.world_verifications (action_id, nullifier)
  where purpose = 'account-humanity'
    and status = 'verified'
    and nullifier is not null;
create unique index world_verifications_subject_purpose_idx
  on public.world_verifications (subject_id, purpose)
  where subject_id is not null and status = 'verified';

create trigger set_record_share_drafts_updated_at
before update on public.record_share_drafts
for each row execute function lozzi_private.set_updated_at();

alter table public.record_share_drafts enable row level security;
alter table public.world_proof_challenges enable row level security;

create policy record_share_drafts_authorized_select
on public.record_share_drafts for select to authenticated
using (
  (select lozzi_private.is_student_self(student_id))
  or (
    select lozzi_private.has_membership(
      institution_id,
      array['registrar', 'institution_admin']
    )
  )
);

create policy world_proof_challenges_authorized_select
on public.world_proof_challenges for select to authenticated
using (
  (select lozzi_private.is_student_self(student_id))
  or (
    select lozzi_private.has_membership(
      institution_id,
      array['registrar', 'institution_admin']
    )
  )
);

revoke all on table public.record_share_drafts
  from public, anon, authenticated, service_role;
revoke all on table public.world_proof_challenges
  from public, anon, authenticated, service_role;
grant select on table public.record_share_drafts
  to authenticated;
grant select on table public.world_proof_challenges
  to authenticated;
grant select, insert, update on table public.record_share_drafts
  to service_role;
grant select, insert, update on table public.world_proof_challenges
  to service_role;

create function public.create_sensitive_share_draft(
  p_student_id uuid,
  p_academic_record_version_id uuid,
  p_recipient_label text,
  p_scopes text[],
  p_grant_expires_at timestamptz,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_institution_id uuid;
  target_user_id uuid;
  draft_id uuid;
  draft_expiry timestamptz := now() + interval '30 minutes';
begin
  if p_recipient_label is null
    or char_length(trim(p_recipient_label)) not between 1 and 120
    or p_scopes is null
    or cardinality(p_scopes) not between 1 and 8
    or not (p_scopes <@ array['program', 'degree-progress', 'record-summary', 'full-record']::text[])
    or p_grant_expires_at <= now()
    or p_grant_expires_at > now() + interval '30 days'
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid sensitive share draft';
  end if;

  select student.institution_id, student.user_id
  into target_institution_id, target_user_id
  from public.students student
  where student.id = p_student_id
    and student.deactivated_at is null;

  if target_institution_id is null
    or not exists (
      select 1
      from public.academic_record_versions record_version
      where record_version.id = p_academic_record_version_id
        and record_version.student_id = p_student_id
        and record_version.institution_id = target_institution_id
        and record_version.status = 'published'
    )
  then
    raise exception using
      errcode = '22023',
      message = 'Student record version not found';
  end if;

  insert into public.record_share_drafts (
    institution_id,
    student_id,
    academic_record_version_id,
    recipient_label,
    scopes,
    draft_expires_at,
    grant_expires_at,
    idempotency_key,
    created_by
  )
  values (
    target_institution_id,
    p_student_id,
    p_academic_record_version_id,
    trim(p_recipient_label),
    p_scopes,
    draft_expiry,
    p_grant_expires_at,
    p_idempotency_key,
    target_user_id
  )
  on conflict (idempotency_key)
  do update set idempotency_key = excluded.idempotency_key
  returning id into draft_id;

  return jsonb_build_object(
    'draftId', draft_id,
    'draftExpiresAt', draft_expiry,
    'grantExpiresAt', p_grant_expires_at,
    'status', 'draft'
  );
end;
$$;

create function public.create_world_proof_challenge(
  p_student_id uuid,
  p_purpose text,
  p_subject_id uuid,
  p_action_id text,
  p_environment text,
  p_nonce bytea,
  p_expected_signal_hash bytea,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_institution_id uuid;
  challenge_id uuid;
begin
  if p_environment not in ('production', 'sandbox', 'staging')
    or p_nonce is null
    or octet_length(p_nonce) <> 32
    or (
      p_expected_signal_hash is not null
      and octet_length(p_expected_signal_hash) <> 32
    )
    or p_expires_at <= now()
    or p_expires_at > now() + interval '10 minutes'
    or not (
      (
        p_purpose = 'account-humanity'
        and p_subject_id is null
        and p_action_id = 'lozzi-student-verification'
      )
      or (
        p_purpose = 'share-liveness'
        and p_subject_id is not null
        and p_action_id = 'lozzi-sensitive-share-selfie-check'
      )
      or (
        p_purpose = 'adult-share-consent'
        and p_subject_id is not null
        and p_action_id = 'lozzi-adult-share-consent'
      )
    )
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid World proof challenge';
  end if;

  select student.institution_id
  into target_institution_id
  from public.students student
  where student.id = p_student_id
    and student.deactivated_at is null;

  if target_institution_id is null then
    raise exception using
      errcode = '22023',
      message = 'Active student not found';
  end if;

  if p_subject_id is not null
    and not exists (
      select 1
      from public.record_share_drafts draft
      where draft.id = p_subject_id
        and draft.student_id = p_student_id
        and draft.institution_id = target_institution_id
        and draft.status in ('draft', 'adult_attested')
        and draft.draft_expires_at > now()
    )
  then
    raise exception using
      errcode = '22023',
      message = 'Active share draft not found';
  end if;

  insert into public.world_proof_challenges (
    institution_id,
    student_id,
    purpose,
    subject_id,
    action_id,
    environment,
    nonce,
    expected_signal_hash,
    expires_at
  )
  values (
    target_institution_id,
    p_student_id,
    p_purpose,
    p_subject_id,
    p_action_id,
    p_environment,
    p_nonce,
    p_expected_signal_hash,
    p_expires_at
  )
  returning id into challenge_id;

  return jsonb_build_object(
    'challengeId', challenge_id,
    'expiresAt', p_expires_at
  );
end;
$$;

create function public.consume_world_proof_challenge(
  p_challenge_id uuid,
  p_student_id uuid,
  p_nullifier numeric,
  p_signal_hash bytea,
  p_credential_type text,
  p_identity_attested boolean,
  p_presence_status text,
  p_protocol_version text,
  p_verified_at timestamptz,
  p_provider_response_id text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  challenge_row public.world_proof_challenges%rowtype;
  verification_id uuid;
begin
  select *
  into challenge_row
  from public.world_proof_challenges challenge
  where challenge.id = p_challenge_id
  for update;

  if challenge_row.id is null
    or challenge_row.student_id <> p_student_id
    or challenge_row.consumed_at is not null
    or challenge_row.expires_at <= now()
    or p_nullifier is null
    or p_nullifier < 0
    or p_nullifier >= 115792089237316195423570985008687907853269984665640564039457584007913129639936
    or p_presence_status not in ('completed', 'not-requested')
    or p_verified_at is null
    or p_verified_at > now() + interval '1 minute'
    or p_verified_at < now() - interval '10 minutes'
    or (
      p_signal_hash is not null
      and octet_length(p_signal_hash) <> 32
    )
    or (
      challenge_row.purpose <> 'adult-share-consent'
      and (
        p_signal_hash is null
        or p_signal_hash <> challenge_row.expected_signal_hash
      )
    )
    or (
      challenge_row.purpose = 'adult-share-consent'
      and (
        p_protocol_version <> '4.0'
        or p_credential_type not in ('passport', 'mnc')
        or p_identity_attested is not true
      )
    )
    or (
      challenge_row.purpose = 'share-liveness'
      and (
        p_protocol_version <> '3.0'
        or p_credential_type <> 'selfie'
      )
    )
    or (
      challenge_row.purpose = 'account-humanity'
      and (
        p_protocol_version not in ('3.0', '4.0')
        or p_credential_type not in ('proof_of_human', 'orb')
      )
    )
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid or expired World proof challenge';
  end if;

  if challenge_row.purpose = 'share-liveness'
    and not exists (
      select 1
      from public.world_verifications verification
      where verification.student_id = p_student_id
        and verification.subject_id = challenge_row.subject_id
        and verification.purpose = 'adult-share-consent'
        and verification.status = 'verified'
        and verification.identity_attested
    )
  then
    raise exception using
      errcode = '22023',
      message = 'Adult consent must be completed first';
  end if;

  insert into public.world_verifications (
    institution_id,
    student_id,
    action_id,
    nullifier_hash,
    nullifier,
    signal_hash,
    credential_type,
    status,
    verified_at,
    provider_response_id,
    protocol_version,
    purpose,
    subject_id,
    challenge_id,
    identity_attested,
    presence_status
  )
  values (
    challenge_row.institution_id,
    challenge_row.student_id,
    challenge_row.action_id,
    extensions.digest(p_nullifier::text, 'sha256'),
    p_nullifier,
    p_signal_hash,
    p_credential_type,
    'verified',
    p_verified_at,
    p_provider_response_id,
    p_protocol_version,
    challenge_row.purpose,
    challenge_row.subject_id,
    challenge_row.id,
    coalesce(p_identity_attested, false),
    p_presence_status
  )
  returning id into verification_id;

  update public.world_proof_challenges
  set consumed_at = now()
  where id = challenge_row.id;

  if challenge_row.purpose = 'adult-share-consent' then
    update public.record_share_drafts
    set
      adult_attested_at = now(),
      status = 'adult_attested'
    where id = challenge_row.subject_id
      and status = 'draft';
  elsif challenge_row.purpose = 'share-liveness' then
    update public.record_share_drafts
    set
      liveness_verified_at = now(),
      status = 'ready'
    where id = challenge_row.subject_id
      and status = 'adult_attested';
  end if;

  insert into public.audit_events (
    institution_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    outcome,
    metadata
  )
  values (
    challenge_row.institution_id,
    null,
    'world.challenge.consume',
    'world_verification',
    verification_id,
    'success',
    jsonb_build_object(
      'purpose', challenge_row.purpose,
      'protocolVersion', p_protocol_version,
      'credentialType', p_credential_type
    )
  );

  return jsonb_build_object(
    'verificationId', verification_id,
    'purpose', challenge_row.purpose,
    'status', 'verified',
    'verifiedAt', p_verified_at
  );
exception
  when unique_violation then
    raise exception using
      errcode = '23505',
      message = 'World verification replay detected';
end;
$$;

create function public.require_registrar_assisted_share_consent(
  p_draft_id uuid,
  p_student_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_institution_id uuid;
begin
  update public.record_share_drafts draft
  set
    status = 'assisted_consent_required',
    assisted_consent_requested_at = now()
  where draft.id = p_draft_id
    and draft.student_id = p_student_id
    and draft.status in ('draft', 'adult_attested')
    and draft.draft_expires_at > now()
  returning draft.institution_id into target_institution_id;

  if target_institution_id is null then
    raise exception using
      errcode = '22023',
      message = 'Active share draft not found';
  end if;

  insert into public.audit_events (
    institution_id,
    action,
    entity_type,
    entity_id,
    outcome,
    metadata
  )
  values (
    target_institution_id,
    'share.assisted_consent.request',
    'record_share_draft',
    p_draft_id,
    'success',
    jsonb_build_object('reason', 'world-attribute-unavailable')
  );

  return jsonb_build_object(
    'draftId', p_draft_id,
    'status', 'assisted_consent_required'
  );
end;
$$;

create function public.activate_sensitive_share(
  p_draft_id uuid,
  p_student_id uuid,
  p_token_hash bytea,
  p_grant_commitment bytea
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  draft_row public.record_share_drafts%rowtype;
  grant_id uuid;
begin
  if p_token_hash is null
    or octet_length(p_token_hash) <> 32
    or p_grant_commitment is null
    or octet_length(p_grant_commitment) <> 32
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid share grant commitment';
  end if;

  select *
  into draft_row
  from public.record_share_drafts draft
  where draft.id = p_draft_id
    and draft.student_id = p_student_id
  for update;

  if draft_row.id is null
    or draft_row.status <> 'ready'
    or draft_row.draft_expires_at <= now()
    or draft_row.grant_expires_at <= now()
    or draft_row.adult_attested_at is null
    or draft_row.liveness_verified_at is null
  then
    raise exception using
      errcode = '22023',
      message = 'Sensitive share is not ready for activation';
  end if;

  insert into public.record_share_grants (
    institution_id,
    student_id,
    academic_record_version_id,
    token_hash,
    grant_commitment,
    recipient_label,
    scopes,
    status,
    expires_at,
    created_by
  )
  values (
    draft_row.institution_id,
    draft_row.student_id,
    draft_row.academic_record_version_id,
    p_token_hash,
    p_grant_commitment,
    draft_row.recipient_label,
    draft_row.scopes,
    'active',
    draft_row.grant_expires_at,
    draft_row.created_by
  )
  returning id into grant_id;

  update public.record_share_drafts
  set
    status = 'active',
    activated_at = now(),
    record_share_grant_id = grant_id
  where id = draft_row.id;

  insert into public.audit_events (
    institution_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    outcome,
    metadata
  )
  values (
    draft_row.institution_id,
    draft_row.created_by,
    'share.sensitive.activate',
    'record_share_grant',
    grant_id,
    'success',
    jsonb_build_object(
      'draftId', draft_row.id,
      'scopes', draft_row.scopes,
      'expiresAt', draft_row.grant_expires_at
    )
  );

  return jsonb_build_object(
    'draftId', draft_row.id,
    'shareGrantId', grant_id,
    'status', 'active',
    'expiresAt', draft_row.grant_expires_at
  );
end;
$$;

revoke all on function public.create_sensitive_share_draft(
  uuid,
  uuid,
  text,
  text[],
  timestamptz,
  uuid
) from public, anon, authenticated;
revoke all on function public.create_world_proof_challenge(
  uuid,
  text,
  uuid,
  text,
  text,
  bytea,
  bytea,
  timestamptz
) from public, anon, authenticated;
revoke all on function public.consume_world_proof_challenge(
  uuid,
  uuid,
  numeric,
  bytea,
  text,
  boolean,
  text,
  text,
  timestamptz,
  text
) from public, anon, authenticated;
revoke all on function public.require_registrar_assisted_share_consent(
  uuid,
  uuid
) from public, anon, authenticated;
revoke all on function public.activate_sensitive_share(
  uuid,
  uuid,
  bytea,
  bytea
) from public, anon, authenticated;

grant execute on function public.create_sensitive_share_draft(
  uuid,
  uuid,
  text,
  text[],
  timestamptz,
  uuid
) to service_role;
grant execute on function public.create_world_proof_challenge(
  uuid,
  text,
  uuid,
  text,
  text,
  bytea,
  bytea,
  timestamptz
) to service_role;
grant execute on function public.consume_world_proof_challenge(
  uuid,
  uuid,
  numeric,
  bytea,
  text,
  boolean,
  text,
  text,
  timestamptz,
  text
) to service_role;
grant execute on function public.require_registrar_assisted_share_consent(
  uuid,
  uuid
) to service_role;
grant execute on function public.activate_sensitive_share(
  uuid,
  uuid,
  bytea,
  bytea
) to service_role;
