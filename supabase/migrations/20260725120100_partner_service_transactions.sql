create function public.record_world_verification(
  p_student_id uuid,
  p_action_id text,
  p_nullifier numeric,
  p_signal_hash bytea,
  p_credential_type text,
  p_verified_at timestamptz,
  p_provider_response_id text,
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
  verification_id uuid;
  replay_result jsonb;
  result_payload jsonb;
begin
  if p_action_id <> 'lozzi-student-verification'
    or p_nullifier is null
    or p_nullifier < 0
    or p_nullifier >= 115792089237316195423570985008687907853269984665640564039457584007913129639936
    or p_signal_hash is null
    or octet_length(p_signal_hash) <> 32
    or p_credential_type not in ('proof_of_human', 'orb')
    or p_verified_at is null
    or p_verified_at > now() + interval '1 minute'
    or p_verified_at < now() - interval '10 minutes'
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid World verification result';
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

  replay_result := lozzi_private.begin_idempotent_operation(
    target_institution_id,
    'world.verification.record',
    p_idempotency_key,
    jsonb_build_object(
      'studentId', p_student_id,
      'actionId', p_action_id,
      'nullifier', p_nullifier,
      'signalHash', encode(p_signal_hash, 'hex'),
      'credentialType', p_credential_type
    )
  );

  if replay_result is not null then
    return replay_result;
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
    provider_response_id
  )
  values (
    target_institution_id,
    p_student_id,
    p_action_id,
    extensions.digest(p_nullifier::text, 'sha256'),
    p_nullifier,
    p_signal_hash,
    p_credential_type,
    'verified',
    p_verified_at,
    p_provider_response_id
  )
  returning id into verification_id;

  result_payload := jsonb_build_object(
    'success', true,
    'verificationId', verification_id,
    'status', 'verified',
    'verifiedAt', p_verified_at
  );

  perform lozzi_private.complete_idempotent_operation(
    target_institution_id,
    'world.verification.record',
    p_idempotency_key,
    verification_id,
    result_payload
  );

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
    'world.verification.record',
    'world_verification',
    verification_id,
    'success',
    jsonb_build_object(
      'credentialType', p_credential_type,
      'protocolVersion', 'world-id-v4'
    )
  );

  return result_payload;
exception
  when unique_violation then
    raise exception using
      errcode = '23505',
      message = 'World nullifier replay detected';
end;
$$;

create function public.record_ens_identity(
  p_student_id uuid,
  p_student_wallet_id uuid,
  p_public_name text,
  p_name_hash bytea,
  p_parent_name text,
  p_resolved_address bytea,
  p_resolver_address bytea,
  p_transaction_hash bytea,
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
  target_wallet_address bytea;
  identity_id uuid;
  replay_result jsonb;
  result_payload jsonb;
begin
  if p_public_name is null
    or p_parent_name is null
    or right(
      lower(p_public_name),
      char_length(p_parent_name) + 1
    ) <> ('.' || lower(p_parent_name))
    or p_name_hash is null
    or octet_length(p_name_hash) <> 32
    or p_resolved_address is null
    or octet_length(p_resolved_address) <> 20
    or (
      p_resolver_address is not null
      and octet_length(p_resolver_address) <> 20
    )
    or (
      p_transaction_hash is not null
      and octet_length(p_transaction_hash) <> 32
    )
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid ENS identity result';
  end if;

  select
    student.institution_id,
    wallet.address
  into
    target_institution_id,
    target_wallet_address
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

  replay_result := lozzi_private.begin_idempotent_operation(
    target_institution_id,
    'ens.identity.record',
    p_idempotency_key,
    jsonb_build_object(
      'studentId', p_student_id,
      'walletId', p_student_wallet_id,
      'nameHash', encode(p_name_hash, 'hex'),
      'resolvedAddress', encode(p_resolved_address, 'hex')
    )
  );

  if replay_result is not null then
    return replay_result;
  end if;

  insert into public.ens_identities (
    institution_id,
    student_id,
    student_wallet_id,
    name_hash,
    public_name,
    parent_name,
    network,
    status,
    resolved_address,
    resolver_address,
    transaction_hash,
    resolved_at
  )
  values (
    target_institution_id,
    p_student_id,
    p_student_wallet_id,
    p_name_hash,
    lower(p_public_name),
    lower(p_parent_name),
    'ethereum-sepolia',
    'active',
    p_resolved_address,
    p_resolver_address,
    p_transaction_hash,
    now()
  )
  returning id into identity_id;

  result_payload := jsonb_build_object(
    'success', true,
    'identityId', identity_id,
    'name', lower(p_public_name),
    'status', 'active'
  );

  perform lozzi_private.complete_idempotent_operation(
    target_institution_id,
    'ens.identity.record',
    p_idempotency_key,
    identity_id,
    result_payload
  );

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
    'ens.identity.record',
    'ens_identity',
    identity_id,
    'success',
    jsonb_build_object('network', 'ethereum-sepolia')
  );

  return result_payload;
end;
$$;

create function public.record_zero_g_object(
  p_student_id uuid,
  p_object_type text,
  p_root_hash bytea,
  p_ciphertext_commitment bytea,
  p_additional_data_commitment bytea,
  p_iv bytea,
  p_wrapping_key_reference text,
  p_object_reference text,
  p_transaction_hash bytea,
  p_size_bytes bigint,
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
  object_id uuid;
  replay_result jsonb;
  result_payload jsonb;
begin
  if p_object_type not in (
      'academic-record-snapshot',
      'degree-audit-context',
      'progress-explanation',
      'record-sharing-package',
      'transcript-document'
    )
    or p_root_hash is null
    or octet_length(p_root_hash) <> 32
    or p_ciphertext_commitment is null
    or octet_length(p_ciphertext_commitment) <> 32
    or p_additional_data_commitment is null
    or octet_length(p_additional_data_commitment) <> 32
    or p_iv is null
    or octet_length(p_iv) <> 12
    or p_wrapping_key_reference is null
    or char_length(p_wrapping_key_reference) not between 1 and 255
    or p_object_reference is null
    or char_length(p_object_reference) not between 1 and 1024
    or (
      p_transaction_hash is not null
      and octet_length(p_transaction_hash) <> 32
    )
    or p_size_bytes is null
    or p_size_bytes <= 0
    or p_size_bytes > 52428800
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid encrypted 0G object result';
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

  replay_result := lozzi_private.begin_idempotent_operation(
    target_institution_id,
    'zero-g.object.record',
    p_idempotency_key,
    jsonb_build_object(
      'studentId', p_student_id,
      'objectType', p_object_type,
      'rootHash', encode(p_root_hash, 'hex'),
      'ciphertextCommitment', encode(p_ciphertext_commitment, 'hex')
    )
  );

  if replay_result is not null then
    return replay_result;
  end if;

  insert into public.zero_g_objects (
    institution_id,
    owner_student_id,
    object_type,
    root_hash,
    encryption_mode,
    wrapping_key_reference,
    status,
    ciphertext_commitment,
    additional_data_commitment,
    iv,
    object_reference,
    transaction_hash,
    size_bytes,
    available_at
  )
  values (
    target_institution_id,
    p_student_id,
    p_object_type,
    p_root_hash,
    'aes-256-gcm',
    p_wrapping_key_reference,
    'available',
    p_ciphertext_commitment,
    p_additional_data_commitment,
    p_iv,
    p_object_reference,
    p_transaction_hash,
    p_size_bytes,
    now()
  )
  returning id into object_id;

  result_payload := jsonb_build_object(
    'success', true,
    'objectId', object_id,
    'status', 'available'
  );

  perform lozzi_private.complete_idempotent_operation(
    target_institution_id,
    'zero-g.object.record',
    p_idempotency_key,
    object_id,
    result_payload
  );

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
    'zero-g.object.record',
    'zero_g_object',
    object_id,
    'success',
    jsonb_build_object(
      'objectType', p_object_type,
      'encryptionMode', 'aes-256-gcm',
      'sizeBytes', p_size_bytes
    )
  );

  return result_payload;
exception
  when unique_violation then
    raise exception using
      errcode = '23505',
      message = '0G root hash already recorded';
end;
$$;

create function public.start_ai_progress_run(
  p_student_id uuid,
  p_provider text,
  p_model text,
  p_verification_mode text,
  p_request_commitment bytea,
  p_input_zero_g_object_id uuid,
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
  run_id uuid;
  replay_result jsonb;
  result_payload jsonb;
begin
  if p_provider <> 'zero-g-router'
    or p_model is null
    or char_length(p_model) not between 1 and 160
    or p_verification_mode is null
    or char_length(p_verification_mode) not between 1 and 80
    or p_request_commitment is null
    or octet_length(p_request_commitment) <> 32
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid 0G Compute run request';
  end if;

  select student.institution_id
  into target_institution_id
  from public.students student
  join public.zero_g_objects input_object
    on input_object.id = p_input_zero_g_object_id
   and input_object.owner_student_id = student.id
   and input_object.institution_id = student.institution_id
   and input_object.status = 'available'
  where student.id = p_student_id
    and student.deactivated_at is null;

  if target_institution_id is null then
    raise exception using
      errcode = '22023',
      message = 'Available encrypted input object not found';
  end if;

  replay_result := lozzi_private.begin_idempotent_operation(
    target_institution_id,
    'zero-g.progress.start',
    p_idempotency_key,
    jsonb_build_object(
      'studentId', p_student_id,
      'provider', p_provider,
      'model', p_model,
      'verificationMode', p_verification_mode,
      'requestCommitment', encode(p_request_commitment, 'hex'),
      'inputObjectId', p_input_zero_g_object_id
    )
  );

  if replay_result is not null then
    return replay_result;
  end if;

  insert into public.ai_inference_runs (
    institution_id,
    student_id,
    provider,
    model,
    verification_mode,
    request_commitment,
    schema_validation_status,
    input_zero_g_object_id
  )
  values (
    target_institution_id,
    p_student_id,
    p_provider,
    p_model,
    p_verification_mode,
    p_request_commitment,
    'pending',
    p_input_zero_g_object_id
  )
  returning id into run_id;

  result_payload := jsonb_build_object(
    'success', true,
    'runId', run_id,
    'status', 'pending'
  );

  perform lozzi_private.complete_idempotent_operation(
    target_institution_id,
    'zero-g.progress.start',
    p_idempotency_key,
    run_id,
    result_payload
  );

  return result_payload;
end;
$$;

create function public.complete_ai_progress_run(
  p_run_id uuid,
  p_response_commitment bytea,
  p_output_zero_g_object_id uuid,
  p_schema_validation_status text,
  p_provider_request_id text,
  p_error_category text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_run public.ai_inference_runs%rowtype;
begin
  if p_schema_validation_status not in ('valid', 'invalid', 'failed')
    or (
      p_response_commitment is not null
      and octet_length(p_response_commitment) <> 32
    )
    or (
      p_schema_validation_status = 'valid'
      and (
        p_response_commitment is null
        or p_output_zero_g_object_id is null
        or p_error_category is not null
      )
    )
    or (
      p_schema_validation_status in ('invalid', 'failed')
      and p_error_category is null
    )
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid 0G Compute completion result';
  end if;

  select inference_run.*
  into target_run
  from public.ai_inference_runs inference_run
  where inference_run.id = p_run_id
  for update;

  if target_run.id is null then
    raise exception using
      errcode = '22023',
      message = '0G Compute run not found';
  end if;

  if target_run.completed_at is not null then
    if target_run.response_commitment is not distinct from p_response_commitment
      and target_run.output_zero_g_object_id is not distinct from p_output_zero_g_object_id
      and target_run.schema_validation_status = p_schema_validation_status
    then
      return jsonb_build_object(
        'success', true,
        'runId', target_run.id,
        'status', target_run.schema_validation_status,
        'idempotentReplay', true
      );
    end if;

    raise exception using
      errcode = '22023',
      message = '0G Compute run was already completed differently';
  end if;

  if p_output_zero_g_object_id is not null
    and not exists (
      select 1
      from public.zero_g_objects output_object
      where output_object.id = p_output_zero_g_object_id
        and output_object.owner_student_id = target_run.student_id
        and output_object.institution_id = target_run.institution_id
        and output_object.status = 'available'
    )
  then
    raise exception using
      errcode = '22023',
      message = 'Available encrypted output object not found';
  end if;

  update public.ai_inference_runs
  set
    response_commitment = p_response_commitment,
    output_zero_g_object_id = p_output_zero_g_object_id,
    schema_validation_status = p_schema_validation_status,
    provider_request_id = p_provider_request_id,
    error_category = p_error_category,
    completed_at = now()
  where id = target_run.id;

  insert into public.audit_events (
    institution_id,
    action,
    entity_type,
    entity_id,
    outcome,
    metadata
  )
  values (
    target_run.institution_id,
    'zero-g.progress.complete',
    'ai_inference_run',
    target_run.id,
    case
      when p_schema_validation_status = 'valid' then 'success'
      else 'failed'
    end,
    jsonb_build_object(
      'schemaValidationStatus', p_schema_validation_status,
      'provider', target_run.provider,
      'errorCategory', p_error_category
    )
  );

  return jsonb_build_object(
    'success', p_schema_validation_status = 'valid',
    'runId', target_run.id,
    'status', p_schema_validation_status
  );
end;
$$;

create function public.set_integration_capability(
  p_institution_id uuid,
  p_provider text,
  p_state text,
  p_detail text,
  p_evidence_reference text,
  p_error_category text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_provider not in (
      'world',
      'world-chain',
      'ens',
      'zero-g',
      'walletconnect'
    )
    or p_state not in (
      'available',
      'mock-development',
      'not-configured',
      'failed'
    )
    or p_detail is null
    or char_length(p_detail) not between 1 and 500
    or (p_state = 'failed' and p_error_category is null)
    or (p_state <> 'failed' and p_error_category is not null)
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid integration capability state';
  end if;

  if not exists (
    select 1
    from public.institutions institution
    where institution.id = p_institution_id
      and institution.status = 'active'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Active institution not found';
  end if;

  insert into public.integration_capabilities (
    institution_id,
    provider,
    state,
    detail,
    last_checked_at,
    evidence_reference,
    error_category
  )
  values (
    p_institution_id,
    p_provider,
    p_state,
    p_detail,
    now(),
    p_evidence_reference,
    p_error_category
  )
  on conflict (institution_id, provider)
  do update set
    state = excluded.state,
    detail = excluded.detail,
    last_checked_at = excluded.last_checked_at,
    evidence_reference = excluded.evidence_reference,
    error_category = excluded.error_category,
    updated_at = now();
end;
$$;

revoke all on function public.record_world_verification(
  uuid,
  text,
  numeric,
  bytea,
  text,
  timestamptz,
  text,
  uuid
) from public, anon, authenticated;
revoke all on function public.record_ens_identity(
  uuid,
  uuid,
  text,
  bytea,
  text,
  bytea,
  bytea,
  bytea,
  uuid
) from public, anon, authenticated;
revoke all on function public.record_zero_g_object(
  uuid,
  text,
  bytea,
  bytea,
  bytea,
  bytea,
  text,
  text,
  bytea,
  bigint,
  uuid
) from public, anon, authenticated;
revoke all on function public.start_ai_progress_run(
  uuid,
  text,
  text,
  text,
  bytea,
  uuid,
  uuid
) from public, anon, authenticated;
revoke all on function public.complete_ai_progress_run(
  uuid,
  bytea,
  uuid,
  text,
  text,
  text
) from public, anon, authenticated;
revoke all on function public.set_integration_capability(
  uuid,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.record_world_verification(
  uuid,
  text,
  numeric,
  bytea,
  text,
  timestamptz,
  text,
  uuid
) to service_role;
grant execute on function public.record_ens_identity(
  uuid,
  uuid,
  text,
  bytea,
  text,
  bytea,
  bytea,
  bytea,
  uuid
) to service_role;
grant execute on function public.record_zero_g_object(
  uuid,
  text,
  bytea,
  bytea,
  bytea,
  bytea,
  text,
  text,
  bytea,
  bigint,
  uuid
) to service_role;
grant execute on function public.start_ai_progress_run(
  uuid,
  text,
  text,
  text,
  bytea,
  uuid,
  uuid
) to service_role;
grant execute on function public.complete_ai_progress_run(
  uuid,
  bytea,
  uuid,
  text,
  text,
  text
) to service_role;
grant execute on function public.set_integration_capability(
  uuid,
  text,
  text,
  text,
  text,
  text
) to service_role;
