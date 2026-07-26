create table public.wallet_link_challenges (
  id uuid primary key,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  chain_id bigint not null default 11155111 check (chain_id = 11155111),
  address bytea not null check (octet_length(address) = 20),
  nonce_hash bytea not null unique check (octet_length(nonce_hash) = 32),
  message_hash bytea not null unique check (octet_length(message_hash) = 32),
  domain text not null check (
    char_length(domain) between 1 and 255
    and domain !~ '[/?#]'
  ),
  uri text not null check (
    char_length(uri) between 1 and 2048
    and (
      uri ~ '^https://'
      or uri ~ '^http://(localhost|127[.]0[.]0[.]1)(:[0-9]{1,5})?(/|$)'
    )
  ),
  consent_version text not null default 'wallet-link-v1'
    check (consent_version = 'wallet-link-v1'),
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > issued_at),
  check (expires_at <= issued_at + interval '10 minutes')
);

create index wallet_link_challenges_student_recent_idx
  on public.wallet_link_challenges (student_id, created_at desc);
create index wallet_link_challenges_unconsumed_expiry_idx
  on public.wallet_link_challenges (expires_at)
  where consumed_at is null;

create trigger set_wallet_link_challenges_updated_at
before update on public.wallet_link_challenges
for each row execute function lozzi_private.set_updated_at();

alter table public.wallet_link_challenges enable row level security;
alter table public.wallet_link_challenges force row level security;

create policy wallet_link_challenges_authorized_select
on public.wallet_link_challenges for select to authenticated
using (
  (select lozzi_private.is_student_self(student_id))
  or (
    select lozzi_private.has_membership(
      institution_id,
      array['registrar', 'institution_admin']
    )
  )
);

revoke all on table public.wallet_link_challenges
  from public, anon, authenticated, service_role;
grant select on table public.wallet_link_challenges to authenticated;
grant select, insert, update on table public.wallet_link_challenges to service_role;

alter table public.ens_identities
  drop constraint ens_identities_status_check;

alter table public.ens_identities
  add constraint ens_identities_status_check
  check (
    status in (
      'not_configured',
      'pending',
      'submitting',
      'submitted',
      'confirmed',
      'active',
      'failed',
      'revocation-pending',
      'revoked'
    )
  ),
  add column request_id uuid,
  add column request_key bytea,
  add column label_hash bytea,
  add column chain_id bigint not null default 11155111,
  add column adapter_address bytea,
  add column consent_version text,
  add column consented_at timestamptz,
  add column submission_started_at timestamptz,
  add column submitted_at timestamptz,
  add column confirmed_at timestamptz,
  add column confirmed_block_number bigint,
  add column confirmation_count integer,
  add column revocation_requested_at timestamptz,
  add column revocation_verified_at timestamptz;

alter table public.ens_identities
  add constraint ens_identities_request_key_check
  check (request_key is null or octet_length(request_key) = 32),
  add constraint ens_identities_label_hash_check
  check (label_hash is null or octet_length(label_hash) = 32),
  add constraint ens_identities_chain_id_check
  check (chain_id = 11155111),
  add constraint ens_identities_adapter_address_check
  check (adapter_address is null or octet_length(adapter_address) = 20),
  add constraint ens_identities_confirmation_count_check
  check (confirmation_count is null or confirmation_count >= 0),
  add constraint ens_identities_confirmed_block_check
  check (confirmed_block_number is null or confirmed_block_number >= 0),
  add constraint ens_identities_real_operation_check
  check (
    request_id is null
    or (
      request_key is not null
      and label_hash is not null
      and student_id is not null
      and student_wallet_id is not null
      and public_name is not null
      and parent_name is not null
      and resolved_address is not null
      and adapter_address is not null
      and consent_version = 'ens-public-alias-v1'
      and consented_at is not null
    )
  ),
  add constraint ens_identities_submission_state_check
  check (
    request_id is null
    or status not in ('submitted', 'confirmed', 'active')
    or (
      transaction_hash is not null
      and submitted_at is not null
    )
  ),
  add constraint ens_identities_confirmation_state_check
  check (
    request_id is null
    or status not in ('confirmed', 'active')
    or (
      confirmed_at is not null
      and confirmed_block_number is not null
      and confirmation_count is not null
      and confirmation_count > 0
    )
  ),
  add constraint ens_identities_revocation_state_check
  check (
    status <> 'revocation-pending'
    or revocation_requested_at is not null
  );

create unique index ens_identities_request_id_idx
  on public.ens_identities (request_id)
  where request_id is not null;
create unique index ens_identities_request_key_idx
  on public.ens_identities (request_key)
  where request_key is not null;
create unique index ens_identities_transaction_hash_idx
  on public.ens_identities (transaction_hash)
  where transaction_hash is not null;
create unique index ens_identities_student_live_idx
  on public.ens_identities (student_id)
  where student_id is not null
    and status in (
      'pending',
      'submitting',
      'submitted',
      'confirmed',
      'active',
      'revocation-pending'
    );
create index ens_identities_reconciliation_idx
  on public.ens_identities (status, submission_started_at, submitted_at)
  where request_id is not null
    and status in ('submitting', 'submitted', 'confirmed');

create function public.create_wallet_link_challenge(
  p_challenge_id uuid,
  p_student_id uuid,
  p_address bytea,
  p_nonce_hash bytea,
  p_message_hash bytea,
  p_domain text,
  p_uri text,
  p_issued_at timestamptz,
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
  recent_challenge_count integer;
begin
  if p_challenge_id is null
    or p_address is null
    or octet_length(p_address) <> 20
    or p_nonce_hash is null
    or octet_length(p_nonce_hash) <> 32
    or p_message_hash is null
    or octet_length(p_message_hash) <> 32
    or p_domain is null
    or char_length(p_domain) not between 1 and 255
    or p_domain ~ '[/?#]'
    or p_uri is null
    or char_length(p_uri) not between 1 and 2048
    or not (
      p_uri ~ '^https://'
      or p_uri ~ '^http://(localhost|127[.]0[.]0[.]1)(:[0-9]{1,5})?(/|$)'
    )
    or p_issued_at > now() + interval '1 minute'
    or p_issued_at < now() - interval '1 minute'
    or p_expires_at <= p_issued_at
    or p_expires_at > p_issued_at + interval '10 minutes'
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid wallet-link challenge';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_student_id::text, 1)
  );

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

  select count(*)
  into recent_challenge_count
  from public.wallet_link_challenges challenge
  where challenge.student_id = p_student_id
    and challenge.created_at > now() - interval '10 minutes';

  if recent_challenge_count >= 5 then
    raise exception using
      errcode = 'P0001',
      message = 'Wallet-link challenge rate limit exceeded';
  end if;

  update public.wallet_link_challenges challenge
  set consumed_at = now()
  where challenge.student_id = p_student_id
    and challenge.consumed_at is null
    and challenge.expires_at > now();

  insert into public.wallet_link_challenges (
    id,
    institution_id,
    student_id,
    address,
    nonce_hash,
    message_hash,
    domain,
    uri,
    issued_at,
    expires_at
  )
  values (
    p_challenge_id,
    target_institution_id,
    p_student_id,
    p_address,
    p_nonce_hash,
    p_message_hash,
    lower(p_domain),
    p_uri,
    p_issued_at,
    p_expires_at
  );

  return jsonb_build_object(
    'challengeId', p_challenge_id,
    'expiresAt', p_expires_at
  );
end;
$$;

create function public.consume_wallet_link_challenge(
  p_challenge_id uuid,
  p_student_id uuid,
  p_address bytea,
  p_message_hash bytea,
  p_verified_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  challenge_row public.wallet_link_challenges%rowtype;
  wallet_id uuid;
begin
  if p_challenge_id is null
    or p_student_id is null
    or p_address is null
    or octet_length(p_address) <> 20
    or p_message_hash is null
    or octet_length(p_message_hash) <> 32
    or p_verified_at is null
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid or expired wallet-link challenge';
  end if;

  select *
  into challenge_row
  from public.wallet_link_challenges challenge
  where challenge.id = p_challenge_id
  for update;

  if challenge_row.id is null
    or challenge_row.student_id <> p_student_id
    or challenge_row.address <> p_address
    or challenge_row.message_hash <> p_message_hash
    or challenge_row.consumed_at is not null
    or challenge_row.expires_at <= now()
    or p_verified_at > now() + interval '1 minute'
    or p_verified_at < challenge_row.issued_at
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid or expired wallet-link challenge';
  end if;

  update public.student_wallets wallet
  set
    status = 'revoked',
    revoked_at = now()
  where wallet.student_id = p_student_id
    and wallet.chain_id = 11155111
    and wallet.status = 'verified'
    and wallet.address <> p_address;

  update public.ens_identities identity
  set
    status = 'revocation-pending',
    revocation_requested_at = now()
  from public.student_wallets wallet
  where identity.student_wallet_id = wallet.id
    and identity.student_id = p_student_id
    and identity.status = 'active'
    and wallet.address <> p_address;

  insert into public.student_wallets (
    institution_id,
    student_id,
    chain_id,
    address,
    status,
    nonce_hash,
    verified_at,
    revoked_at
  )
  values (
    challenge_row.institution_id,
    challenge_row.student_id,
    11155111,
    challenge_row.address,
    'verified',
    challenge_row.nonce_hash,
    p_verified_at,
    null
  )
  on conflict (chain_id, address)
  do update set
    status = 'verified',
    nonce_hash = excluded.nonce_hash,
    verified_at = excluded.verified_at,
    revoked_at = null
  where public.student_wallets.institution_id = excluded.institution_id
    and public.student_wallets.student_id = excluded.student_id
  returning id into wallet_id;

  if wallet_id is null then
    raise exception using
      errcode = '23505',
      message = 'Wallet is already linked to another student';
  end if;

  update public.wallet_link_challenges
  set consumed_at = now()
  where id = challenge_row.id;

  insert into public.audit_events (
    institution_id,
    action,
    entity_type,
    entity_id,
    outcome,
    metadata
  )
  values (
    challenge_row.institution_id,
    'wallet.link.verify',
    'student_wallet',
    wallet_id,
    'success',
    jsonb_build_object(
      'chainId', 11155111,
      'consentVersion', challenge_row.consent_version
    )
  );

  return jsonb_build_object(
    'walletId', wallet_id,
    'address', encode(challenge_row.address, 'hex'),
    'status', 'verified',
    'verifiedAt', p_verified_at
  );
end;
$$;

create function public.reserve_ens_issuance(
  p_student_id uuid,
  p_student_wallet_id uuid,
  p_request_id uuid,
  p_request_key bytea,
  p_public_name text,
  p_name_hash bytea,
  p_parent_name text,
  p_label_hash bytea,
  p_resolved_address bytea,
  p_adapter_address bytea,
  p_consented_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_institution_id uuid;
  target_wallet_address bytea;
  operation_row public.ens_identities%rowtype;
begin
  if p_request_id is null
    or p_request_key is null
    or octet_length(p_request_key) <> 32
    or p_public_name is null
    or p_parent_name is null
    or right(
      lower(p_public_name),
      char_length(p_parent_name) + 1
    ) <> ('.' || lower(p_parent_name))
    or p_name_hash is null
    or octet_length(p_name_hash) <> 32
    or p_label_hash is null
    or octet_length(p_label_hash) <> 32
    or p_resolved_address is null
    or octet_length(p_resolved_address) <> 20
    or p_adapter_address is null
    or octet_length(p_adapter_address) <> 20
    or p_consented_at > now() + interval '1 minute'
    or p_consented_at < now() - interval '10 minutes'
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid ENS issuance reservation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_student_id::text, 2)
  );

  select student.institution_id, wallet.address
  into target_institution_id, target_wallet_address
  from public.students student
  join public.student_wallets wallet
    on wallet.student_id = student.id
   and wallet.institution_id = student.institution_id
  where student.id = p_student_id
    and student.deactivated_at is null
    and wallet.id = p_student_wallet_id
    and wallet.chain_id = 11155111
    and wallet.status = 'verified';

  if target_institution_id is null
    or target_wallet_address <> p_resolved_address
  then
    raise exception using
      errcode = '22023',
      message = 'Verified Ethereum Sepolia wallet not found';
  end if;

  select *
  into operation_row
  from public.ens_identities identity
  where identity.student_id = p_student_id
    and identity.status in (
      'pending',
      'submitting',
      'submitted',
      'confirmed',
      'active',
      'revocation-pending'
    )
  order by identity.created_at desc
  limit 1
  for update;

  if operation_row.id is not null then
    return jsonb_build_object(
      'operationId', operation_row.id,
      'requestId', operation_row.request_id,
      'requestKey',
        case
          when operation_row.request_key is null then null
          else encode(operation_row.request_key, 'hex')
        end,
      'name', operation_row.public_name,
      'status', operation_row.status,
      'transactionHash',
        case
          when operation_row.transaction_hash is null then null
          else encode(operation_row.transaction_hash, 'hex')
        end
    );
  end if;

  insert into public.ens_identities (
    institution_id,
    student_id,
    student_wallet_id,
    name_hash,
    public_name,
    parent_name,
    label_hash,
    network,
    chain_id,
    status,
    resolved_address,
    adapter_address,
    request_id,
    request_key,
    consent_version,
    consented_at
  )
  values (
    target_institution_id,
    p_student_id,
    p_student_wallet_id,
    p_name_hash,
    lower(p_public_name),
    lower(p_parent_name),
    p_label_hash,
    'ethereum-sepolia',
    11155111,
    'pending',
    p_resolved_address,
    p_adapter_address,
    p_request_id,
    p_request_key,
    'ens-public-alias-v1',
    p_consented_at
  )
  returning * into operation_row;

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
    'ens.issuance.reserve',
    'ens_identity',
    operation_row.id,
    'success',
    jsonb_build_object(
      'chainId', 11155111,
      'consentVersion', 'ens-public-alias-v1',
      'status', 'pending'
    )
  );

  return jsonb_build_object(
    'operationId', operation_row.id,
    'requestId', operation_row.request_id,
    'requestKey', encode(operation_row.request_key, 'hex'),
    'name', operation_row.public_name,
    'status', operation_row.status,
    'transactionHash', null
  );
end;
$$;

create function public.begin_ens_issuance_submission(
  p_operation_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  operation_row public.ens_identities%rowtype;
  submission_authorized boolean := false;
begin
  select *
  into operation_row
  from public.ens_identities identity
  where identity.id = p_operation_id
    and identity.request_id = p_request_id
  for update;

  if operation_row.id is null then
    raise exception using
      errcode = '22023',
      message = 'ENS issuance operation not found';
  end if;

  if operation_row.status = 'pending' then
    update public.ens_identities
    set
      status = 'submitting',
      submission_started_at = now()
    where id = operation_row.id
    returning * into operation_row;
    submission_authorized := true;
  elsif operation_row.status not in (
    'submitting',
    'submitted',
    'confirmed',
    'active'
  ) then
    raise exception using
      errcode = '22023',
      message = 'ENS issuance cannot be submitted from its current state';
  end if;

  return jsonb_build_object(
    'operationId', operation_row.id,
    'submissionAuthorized', submission_authorized,
    'status', operation_row.status,
    'transactionHash',
      case
        when operation_row.transaction_hash is null then null
        else encode(operation_row.transaction_hash, 'hex')
      end
  );
end;
$$;

create function public.mark_ens_issuance_submitted(
  p_operation_id uuid,
  p_request_id uuid,
  p_transaction_hash bytea,
  p_submitted_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  operation_row public.ens_identities%rowtype;
begin
  if p_transaction_hash is null
    or octet_length(p_transaction_hash) <> 32
    or p_submitted_at > now() + interval '1 minute'
    or p_submitted_at < now() - interval '30 minutes'
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid ENS submission evidence';
  end if;

  select *
  into operation_row
  from public.ens_identities identity
  where identity.id = p_operation_id
    and identity.request_id = p_request_id
  for update;

  if operation_row.id is null
    or operation_row.status not in ('submitting', 'submitted', 'confirmed', 'active')
    or (
      operation_row.transaction_hash is not null
      and operation_row.transaction_hash <> p_transaction_hash
    )
  then
    raise exception using
      errcode = '22023',
      message = 'ENS issuance submission does not match its reservation';
  end if;

  if operation_row.status = 'submitting' then
    update public.ens_identities
    set
      status = 'submitted',
      transaction_hash = p_transaction_hash,
      submitted_at = p_submitted_at
    where id = operation_row.id
    returning * into operation_row;

    insert into public.audit_events (
      institution_id,
      action,
      entity_type,
      entity_id,
      outcome,
      metadata
    )
    values (
      operation_row.institution_id,
      'ens.issuance.submit',
      'ens_identity',
      operation_row.id,
      'success',
      jsonb_build_object('chainId', 11155111, 'status', 'submitted')
    );
  end if;

  return jsonb_build_object(
    'operationId', operation_row.id,
    'status', operation_row.status,
    'transactionHash', encode(operation_row.transaction_hash, 'hex')
  );
end;
$$;

create function public.finalize_ens_issuance(
  p_operation_id uuid,
  p_request_id uuid,
  p_transaction_hash bytea,
  p_resolver_address bytea,
  p_resolved_address bytea,
  p_confirmed_block_number bigint,
  p_confirmation_count integer,
  p_confirmed_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  operation_row public.ens_identities%rowtype;
begin
  if p_transaction_hash is null
    or octet_length(p_transaction_hash) <> 32
    or p_resolver_address is null
    or octet_length(p_resolver_address) <> 20
    or p_resolved_address is null
    or octet_length(p_resolved_address) <> 20
    or p_confirmed_block_number is null
    or p_confirmed_block_number < 0
    or p_confirmation_count is null
    or p_confirmation_count < 1
    or p_confirmed_at is null
    or p_confirmed_at > now() + interval '1 minute'
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid ENS confirmation evidence';
  end if;

  select *
  into operation_row
  from public.ens_identities identity
  where identity.id = p_operation_id
    and identity.request_id = p_request_id
  for update;

  if operation_row.id is null
    or operation_row.status not in ('submitted', 'confirmed', 'active')
    or operation_row.transaction_hash <> p_transaction_hash
    or operation_row.resolved_address <> p_resolved_address
    or (
      operation_row.status = 'active'
      and (
        operation_row.resolver_address <> p_resolver_address
        or operation_row.confirmed_block_number <> p_confirmed_block_number
      )
    )
  then
    raise exception using
      errcode = '22023',
      message = 'ENS confirmation does not match its reservation';
  end if;

  if operation_row.status <> 'active' then
    update public.ens_identities
    set
      status = 'active',
      resolver_address = p_resolver_address,
      resolved_at = p_confirmed_at,
      confirmed_at = p_confirmed_at,
      confirmed_block_number = p_confirmed_block_number,
      confirmation_count = p_confirmation_count,
      error_category = null
    where id = operation_row.id
    returning * into operation_row;

    insert into public.audit_events (
      institution_id,
      action,
      entity_type,
      entity_id,
      outcome,
      metadata
    )
    values (
      operation_row.institution_id,
      'ens.issuance.confirm',
      'ens_identity',
      operation_row.id,
      'success',
      jsonb_build_object(
        'chainId', 11155111,
        'confirmations', p_confirmation_count,
        'status', 'active'
      )
    );
  end if;

  return jsonb_build_object(
    'operationId', operation_row.id,
    'name', operation_row.public_name,
    'status', operation_row.status,
    'transactionHash', encode(operation_row.transaction_hash, 'hex')
  );
end;
$$;

create function public.fail_ens_issuance_reservation(
  p_operation_id uuid,
  p_request_id uuid,
  p_error_category text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  operation_row public.ens_identities%rowtype;
begin
  if p_error_category not in (
    'configuration',
    'authentication',
    'authorization',
    'invalid-request',
    'invalid-response',
    'network',
    'rate-limited',
    'timeout',
    'provider-unavailable',
    'replay',
    'integrity',
    'unknown'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Invalid ENS error category';
  end if;

  update public.ens_identities identity
  set
    status = 'failed',
    error_category = p_error_category
  where identity.id = p_operation_id
    and identity.request_id = p_request_id
    and identity.status = 'pending'
  returning * into operation_row;

  if operation_row.id is null then
    raise exception using
      errcode = '22023',
      message = 'Only an unsubmitted ENS reservation can fail automatically';
  end if;

  return jsonb_build_object(
    'operationId', operation_row.id,
    'status', operation_row.status
  );
end;
$$;

create function public.revoke_student_wallet(
  p_student_id uuid,
  p_student_wallet_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  wallet_row public.student_wallets%rowtype;
  identity_id uuid;
begin
  select *
  into wallet_row
  from public.student_wallets wallet
  where wallet.id = p_student_wallet_id
    and wallet.student_id = p_student_id
    and wallet.chain_id = 11155111
  for update;

  if wallet_row.id is null or wallet_row.status <> 'verified' then
    raise exception using
      errcode = '22023',
      message = 'Verified Sepolia wallet not found';
  end if;

  update public.student_wallets
  set
    status = 'revoked',
    revoked_at = now()
  where id = wallet_row.id;

  update public.ens_identities identity
  set
    status = 'revocation-pending',
    revocation_requested_at = now()
  where identity.student_wallet_id = wallet_row.id
    and identity.status = 'active'
  returning id into identity_id;

  insert into public.audit_events (
    institution_id,
    action,
    entity_type,
    entity_id,
    outcome,
    metadata
  )
  values (
    wallet_row.institution_id,
    'wallet.link.revoke',
    'student_wallet',
    wallet_row.id,
    'success',
    jsonb_build_object(
      'chainId', 11155111,
      'ensClearRequired', identity_id is not null
    )
  );

  return jsonb_build_object(
    'walletId', wallet_row.id,
    'status', 'revoked',
    'ensOperationId', identity_id,
    'ensClearRequired', identity_id is not null
  );
end;
$$;

create function public.finalize_ens_revocation(
  p_operation_id uuid,
  p_observed_address bytea,
  p_verified_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  operation_row public.ens_identities%rowtype;
begin
  if p_verified_at is null
    or (
      p_observed_address is not null
      and (
        octet_length(p_observed_address) <> 20
        or p_observed_address <> decode(repeat('00', 20), 'hex')
      )
    )
    or p_verified_at > now() + interval '1 minute'
  then
    raise exception using
      errcode = '22023',
      message = 'ENS revocation has not been verified';
  end if;

  update public.ens_identities identity
  set
    status = 'revoked',
    revocation_verified_at = p_verified_at
  where identity.id = p_operation_id
    and identity.status = 'revocation-pending'
  returning * into operation_row;

  if operation_row.id is null then
    raise exception using
      errcode = '22023',
      message = 'Pending ENS revocation not found';
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
    operation_row.institution_id,
    'ens.revocation.confirm',
    'ens_identity',
    operation_row.id,
    'success',
    jsonb_build_object('chainId', 11155111, 'status', 'revoked')
  );

  return jsonb_build_object(
    'operationId', operation_row.id,
    'status', operation_row.status
  );
end;
$$;

revoke all on function public.create_wallet_link_challenge(
  uuid,
  uuid,
  bytea,
  bytea,
  bytea,
  text,
  text,
  timestamptz,
  timestamptz
) from public, anon, authenticated;
revoke all on function public.consume_wallet_link_challenge(
  uuid,
  uuid,
  bytea,
  bytea,
  timestamptz
) from public, anon, authenticated;
revoke all on function public.reserve_ens_issuance(
  uuid,
  uuid,
  uuid,
  bytea,
  text,
  bytea,
  text,
  bytea,
  bytea,
  bytea,
  timestamptz
) from public, anon, authenticated;
revoke all on function public.begin_ens_issuance_submission(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.mark_ens_issuance_submitted(
  uuid,
  uuid,
  bytea,
  timestamptz
) from public, anon, authenticated;
revoke all on function public.finalize_ens_issuance(
  uuid,
  uuid,
  bytea,
  bytea,
  bytea,
  bigint,
  integer,
  timestamptz
) from public, anon, authenticated;
revoke all on function public.fail_ens_issuance_reservation(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.revoke_student_wallet(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_ens_revocation(uuid, bytea, timestamptz)
  from public, anon, authenticated;

grant execute on function public.create_wallet_link_challenge(
  uuid,
  uuid,
  bytea,
  bytea,
  bytea,
  text,
  text,
  timestamptz,
  timestamptz
) to service_role;
grant execute on function public.consume_wallet_link_challenge(
  uuid,
  uuid,
  bytea,
  bytea,
  timestamptz
) to service_role;
grant execute on function public.reserve_ens_issuance(
  uuid,
  uuid,
  uuid,
  bytea,
  text,
  bytea,
  text,
  bytea,
  bytea,
  bytea,
  timestamptz
) to service_role;
grant execute on function public.begin_ens_issuance_submission(uuid, uuid)
  to service_role;
grant execute on function public.mark_ens_issuance_submitted(
  uuid,
  uuid,
  bytea,
  timestamptz
) to service_role;
grant execute on function public.finalize_ens_issuance(
  uuid,
  uuid,
  bytea,
  bytea,
  bytea,
  bigint,
  integer,
  timestamptz
) to service_role;
grant execute on function public.fail_ens_issuance_reservation(uuid, uuid, text)
  to service_role;
grant execute on function public.revoke_student_wallet(uuid, uuid)
  to service_role;
grant execute on function public.finalize_ens_revocation(uuid, bytea, timestamptz)
  to service_role;

revoke execute on function public.record_ens_identity(
  uuid,
  uuid,
  text,
  bytea,
  text,
  bytea,
  bytea,
  bytea,
  uuid
) from service_role;

comment on function public.record_ens_identity(
  uuid,
  uuid,
  text,
  bytea,
  text,
  bytea,
  bytea,
  bytea,
  uuid
) is
  'Deprecated: real ENS issuance must use the reserve/submit/finalize lifecycle.';
