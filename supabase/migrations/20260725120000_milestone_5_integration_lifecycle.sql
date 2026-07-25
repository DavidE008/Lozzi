alter table public.world_verifications
  alter column nullifier_hash drop not null,
  add column nullifier numeric(78, 0),
  add column provider_response_id text,
  add column protocol_version text not null default 'world-id-v4',
  add column error_category text;

alter table public.world_verifications
  add constraint world_verifications_nullifier_range_check
  check (
    nullifier is null
    or (
      nullifier >= 0
      and nullifier < 115792089237316195423570985008687907853269984665640564039457584007913129639936
    )
  ),
  add constraint world_verifications_credential_type_check
  check (credential_type in ('proof_of_human', 'nfc', 'selfie', 'orb')),
  add constraint world_verifications_error_category_check
  check (
    error_category is null
    or error_category in (
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
    )
  ),
  add constraint world_verifications_verified_state_check
  check (
    status <> 'verified'
    or (
      nullifier is not null
      and verified_at is not null
      and octet_length(signal_hash) = 32
    )
  );

create unique index world_verifications_action_nullifier_idx
  on public.world_verifications (action_id, nullifier)
  where nullifier is not null;
create index world_verifications_student_recent_idx
  on public.world_verifications (student_id, created_at desc);

alter table public.ens_identities
  add column student_wallet_id uuid references public.student_wallets(id) on delete restrict,
  add column parent_name text,
  add column resolved_address bytea,
  add column resolver_address bytea,
  add column transaction_hash bytea,
  add column error_category text;

alter table public.ens_identities
  add constraint ens_identities_resolved_address_check
  check (
    resolved_address is null
    or octet_length(resolved_address) = 20
  ),
  add constraint ens_identities_resolver_address_check
  check (
    resolver_address is null
    or octet_length(resolver_address) = 20
  ),
  add constraint ens_identities_transaction_hash_check
  check (
    transaction_hash is null
    or octet_length(transaction_hash) = 32
  ),
  add constraint ens_identities_error_category_check
  check (
    error_category is null
    or error_category in (
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
    )
  ),
  add constraint ens_identities_active_state_check
  check (
    status <> 'active'
    or (
      student_wallet_id is not null
      and public_name is not null
      and parent_name is not null
      and resolved_address is not null
      and resolved_at is not null
    )
  );

create index ens_identities_student_recent_idx
  on public.ens_identities (student_id, created_at desc)
  where student_id is not null;
create index ens_identities_wallet_idx
  on public.ens_identities (student_wallet_id)
  where student_wallet_id is not null;

alter table public.zero_g_objects
  add column ciphertext_commitment bytea,
  add column additional_data_commitment bytea,
  add column iv bytea,
  add column object_reference text,
  add column transaction_hash bytea,
  add column size_bytes bigint,
  add column error_category text,
  add column available_at timestamptz;

alter table public.zero_g_objects
  add constraint zero_g_objects_ciphertext_commitment_check
  check (
    ciphertext_commitment is null
    or octet_length(ciphertext_commitment) = 32
  ),
  add constraint zero_g_objects_additional_data_commitment_check
  check (
    additional_data_commitment is null
    or octet_length(additional_data_commitment) = 32
  ),
  add constraint zero_g_objects_iv_check
  check (
    iv is null
    or octet_length(iv) = 12
  ),
  add constraint zero_g_objects_transaction_hash_check
  check (
    transaction_hash is null
    or octet_length(transaction_hash) = 32
  ),
  add constraint zero_g_objects_size_bytes_check
  check (size_bytes is null or size_bytes > 0),
  add constraint zero_g_objects_error_category_check
  check (
    error_category is null
    or error_category in (
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
    )
  ),
  add constraint zero_g_objects_available_state_check
  check (
    status <> 'available'
    or (
      ciphertext_commitment is not null
      and additional_data_commitment is not null
      and object_reference is not null
      and size_bytes is not null
      and available_at is not null
      and (
        encryption_mode <> 'aes-256-gcm'
        or iv is not null
      )
    )
  );

alter table public.ai_inference_runs
  add column input_zero_g_object_id uuid references public.zero_g_objects(id) on delete restrict,
  add column output_zero_g_object_id uuid references public.zero_g_objects(id) on delete restrict,
  add column provider_request_id text;

alter table public.ai_inference_runs
  add constraint ai_inference_runs_error_category_check
  check (
    error_category is null
    or error_category in (
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
    )
  ),
  add constraint ai_inference_runs_completion_check
  check (
    completed_at is null
    or schema_validation_status in ('valid', 'invalid', 'failed')
  );

create index ai_inference_runs_input_object_idx
  on public.ai_inference_runs (input_zero_g_object_id)
  where input_zero_g_object_id is not null;
create index ai_inference_runs_output_object_idx
  on public.ai_inference_runs (output_zero_g_object_id)
  where output_zero_g_object_id is not null;

alter table public.integration_capabilities
  add column evidence_reference text,
  add column error_category text;

alter table public.integration_capabilities
  add constraint integration_capabilities_error_category_check
  check (
    error_category is null
    or error_category in (
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
    )
  ),
  add constraint integration_capabilities_failed_state_check
  check (
    state <> 'failed'
    or error_category is not null
  );

drop policy world_verifications_authorized_select
  on public.world_verifications;
create policy world_verifications_authorized_select
on public.world_verifications for select to authenticated
using (
  (select lozzi_private.is_student_self(student_id))
  or (
    select lozzi_private.has_membership(
      institution_id,
      array['registrar', 'institution_admin']
    )
  )
);

drop policy ens_identities_authorized_select
  on public.ens_identities;
create policy ens_identities_authorized_select
on public.ens_identities for select to authenticated
using (
  student_id is not null
  and (
    (select lozzi_private.is_student_self(student_id))
    or (
      select lozzi_private.has_membership(
        institution_id,
        array['registrar', 'institution_admin']
      )
    )
  )
);

drop policy zero_g_objects_authorized_select
  on public.zero_g_objects;
create policy zero_g_objects_authorized_select
on public.zero_g_objects for select to authenticated
using (
  owner_student_id is not null
  and (
    (select lozzi_private.is_student_self(owner_student_id))
    or (
      select lozzi_private.has_membership(
        institution_id,
        array['registrar', 'institution_admin']
      )
    )
  )
);

drop policy ai_inference_runs_authorized_select
  on public.ai_inference_runs;
create policy ai_inference_runs_authorized_select
on public.ai_inference_runs for select to authenticated
using (
  (select lozzi_private.is_student_self(student_id))
  or (select lozzi_private.is_assigned_advisor(student_id))
  or (
    select lozzi_private.has_membership(
      institution_id,
      array['registrar', 'institution_admin']
    )
  )
);

create view public.student_partner_summary
with (security_invoker = true)
as
select
  student.id as student_id,
  student.user_id,
  student.institution_id,
  world.status as world_status,
  world.credential_type as world_credential_type,
  world.verified_at as world_verified_at,
  ens.public_name as ens_name,
  ens.network as ens_network,
  ens.status as ens_status,
  ens.resolved_at as ens_resolved_at,
  storage.status as storage_status,
  storage.available_at as storage_available_at,
  inference.schema_validation_status as ai_validation_status,
  inference.completed_at as ai_completed_at
from public.students student
left join lateral (
  select
    verification.status,
    verification.credential_type,
    verification.verified_at
  from public.world_verifications verification
  where verification.student_id = student.id
  order by verification.created_at desc
  limit 1
) world on true
left join lateral (
  select
    identity.public_name,
    identity.network,
    identity.status,
    identity.resolved_at
  from public.ens_identities identity
  where identity.student_id = student.id
  order by identity.created_at desc
  limit 1
) ens on true
left join lateral (
  select
    object.status,
    object.available_at
  from public.zero_g_objects object
  where object.owner_student_id = student.id
  order by object.created_at desc
  limit 1
) storage on true
left join lateral (
  select
    inference_run.schema_validation_status,
    inference_run.completed_at
  from public.ai_inference_runs inference_run
  where inference_run.student_id = student.id
  order by inference_run.created_at desc
  limit 1
) inference on true
where student.deactivated_at is null;

revoke all on table public.student_partner_summary
  from public, anon;
grant select on table public.student_partner_summary
  to authenticated, service_role;
