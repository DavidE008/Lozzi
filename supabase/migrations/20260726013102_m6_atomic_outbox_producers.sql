alter table public.academic_record_versions
  add column commitment_environment text,
  add column institution_commitment bytea,
  add column institution_commitment_algorithm text,
  add column institution_commitment_key_version integer,
  add column student_commitment bytea,
  add column student_commitment_algorithm text,
  add column student_commitment_key_version integer,
  add constraint academic_record_versions_opaque_identity_check check (
    (
      num_nonnulls(
        commitment_environment,
        institution_commitment,
        institution_commitment_algorithm,
        institution_commitment_key_version,
        student_commitment,
        student_commitment_algorithm,
        student_commitment_key_version
      ) = 0
    )
    or (
      num_nulls(
        commitment_environment,
        institution_commitment,
        institution_commitment_algorithm,
        institution_commitment_key_version,
        student_commitment,
        student_commitment_algorithm,
        student_commitment_key_version
      ) = 0
      and
      commitment_environment in ('development', 'test', 'staging', 'production')
      and octet_length(institution_commitment) = 32
      and institution_commitment_algorithm = 'lozzi-institution-v1'
      and institution_commitment_key_version > 0
      and octet_length(student_commitment) = 32
      and student_commitment_algorithm = 'lozzi-student-v1'
      and student_commitment_key_version > 0
    )
  );

alter table public.record_share_grants
  add column commitment_environment text,
  add column institution_commitment bytea,
  add column institution_commitment_algorithm text,
  add column institution_commitment_key_version integer,
  add column student_commitment bytea,
  add column student_commitment_algorithm text,
  add column student_commitment_key_version integer,
  add constraint record_share_grants_opaque_identity_check check (
    (
      num_nonnulls(
        commitment_environment,
        institution_commitment,
        institution_commitment_algorithm,
        institution_commitment_key_version,
        student_commitment,
        student_commitment_algorithm,
        student_commitment_key_version
      ) = 0
    )
    or (
      num_nulls(
        commitment_environment,
        institution_commitment,
        institution_commitment_algorithm,
        institution_commitment_key_version,
        student_commitment,
        student_commitment_algorithm,
        student_commitment_key_version
      ) = 0
      and
      commitment_environment in ('development', 'test', 'staging', 'production')
      and octet_length(institution_commitment) = 32
      and institution_commitment_algorithm = 'lozzi-institution-v1'
      and institution_commitment_key_version > 0
      and octet_length(student_commitment) = 32
      and student_commitment_algorithm = 'lozzi-student-v1'
      and student_commitment_key_version > 0
    )
  );

alter table public.outbox_events
  add column schema_version integer not null default 1 check (schema_version > 0),
  add column trace_id uuid not null default gen_random_uuid(),
  add column correlation_id uuid not null default gen_random_uuid();

alter table public.outbox_events
  drop constraint outbox_events_idempotency_key_key;

create unique index outbox_events_idempotency_scope_idx
  on public.outbox_events (institution_id, event_type, idempotency_key);

create unique index outbox_events_logical_event_idx
  on public.outbox_events (event_type, aggregate_id);

create function lozzi_private.m6_has_exact_jsonb_keys(
  p_value jsonb,
  p_expected text[]
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select jsonb_typeof(p_value) = 'object'
    and coalesce(
      (
        select array_agg(key_name order by key_name)
        from jsonb_object_keys(p_value) as keys(key_name)
      ),
      array[]::text[]
    ) = (
      select array_agg(key_name order by key_name)
      from unnest(p_expected) as keys(key_name)
    )
$$;

create function lozzi_private.m6_valid_commitment_identity_payload(
  p_payload jsonb
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select p_payload ->> 'commitmentEnvironment'
      in ('development', 'test', 'staging', 'production')
    and p_payload ->> 'institutionCommitment'
      ~ '^0x[0-9a-f]{64}$'
    and p_payload ->> 'institutionCommitmentAlgorithm'
      = 'lozzi-institution-v1'
    and (p_payload ->> 'institutionCommitmentKeyVersion') ~ '^[1-9][0-9]*$'
    and (p_payload ->> 'institutionCommitmentKeyVersion')::numeric
      <= 2147483647
    and p_payload ->> 'studentCommitment'
      ~ '^0x[0-9a-f]{64}$'
    and p_payload ->> 'studentCommitmentAlgorithm'
      = 'lozzi-student-v1'
    and (p_payload ->> 'studentCommitmentKeyVersion') ~ '^[1-9][0-9]*$'
    and (p_payload ->> 'studentCommitmentKeyVersion')::numeric
      <= 2147483647
$$;

create function lozzi_private.m6_valid_share_scopes(
  p_scopes jsonb
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select jsonb_typeof(p_scopes) = 'array'
    and jsonb_array_length(p_scopes) between 1 and 4
    and not exists (
      select 1
      from jsonb_array_elements_text(p_scopes) as scope(value)
      where scope.value not in (
        'program',
        'degree-progress',
        'record-summary',
        'full-record'
      )
    )
    and (
      select count(*)
      from jsonb_array_elements_text(p_scopes)
    ) = (
      select count(distinct scope.value)
      from jsonb_array_elements_text(p_scopes) as scope(value)
    )
$$;

create function lozzi_private.m6_valid_outbox_payload(
  p_event_type text,
  p_payload jsonb
)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
begin
  if not lozzi_private.m6_valid_commitment_identity_payload(p_payload) then
    return false;
  end if;

  if p_event_type = 'academic_record.anchor.requested.v1' then
    return lozzi_private.m6_has_exact_jsonb_keys(
      p_payload,
      array[
        'academicRecordVersionId',
        'commitmentEnvironment',
        'institutionCommitment',
        'institutionCommitmentAlgorithm',
        'institutionCommitmentKeyVersion',
        'recordCommitment',
        'recordCommitmentAlgorithm',
        'studentCommitment',
        'studentCommitmentAlgorithm',
        'studentCommitmentKeyVersion'
      ]
    )
      and p_payload ->> 'academicRecordVersionId'
        ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and p_payload ->> 'recordCommitment' ~ '^0x[0-9a-f]{64}$'
      and p_payload ->> 'recordCommitmentAlgorithm' = 'lozzi-rfc8785-v1';
  end if;

  if p_event_type = 'share_grant.create.requested.v1' then
    return lozzi_private.m6_has_exact_jsonb_keys(
      p_payload,
      array[
        'academicRecordVersionId',
        'commitmentEnvironment',
        'expiresAt',
        'grantCommitment',
        'institutionCommitment',
        'institutionCommitmentAlgorithm',
        'institutionCommitmentKeyVersion',
        'scopes',
        'shareGrantId',
        'studentCommitment',
        'studentCommitmentAlgorithm',
        'studentCommitmentKeyVersion'
      ]
    )
      and p_payload ->> 'academicRecordVersionId'
        ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and p_payload ->> 'shareGrantId'
        ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and p_payload ->> 'grantCommitment' ~ '^0x[0-9a-f]{64}$'
      and jsonb_typeof(p_payload -> 'expiresAt') = 'string'
      and lozzi_private.m6_valid_share_scopes(p_payload -> 'scopes');
  end if;

  if p_event_type = 'share_grant.revoke.requested.v1' then
    return lozzi_private.m6_has_exact_jsonb_keys(
      p_payload,
      array[
        'commitmentEnvironment',
        'grantCommitment',
        'institutionCommitment',
        'institutionCommitmentAlgorithm',
        'institutionCommitmentKeyVersion',
        'revokedAt',
        'shareGrantId',
        'studentCommitment',
        'studentCommitmentAlgorithm',
        'studentCommitmentKeyVersion'
      ]
    )
      and p_payload ->> 'shareGrantId'
        ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and p_payload ->> 'grantCommitment' ~ '^0x[0-9a-f]{64}$'
      and jsonb_typeof(p_payload -> 'revokedAt') = 'string';
  end if;

  return false;
end;
$$;

alter table public.outbox_events
  add constraint outbox_events_m6_payload_check check (
    event_type not in (
      'academic_record.anchor.requested.v1',
      'share_grant.create.requested.v1',
      'share_grant.revoke.requested.v1'
    )
    or (
      schema_version = 1
      and lozzi_private.m6_valid_outbox_payload(event_type, payload)
    )
  );

create function lozzi_private.enqueue_m6_outbox_event(
  p_institution_id uuid,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_event_type text,
  p_payload jsonb,
  p_idempotency_key uuid,
  p_trace_id uuid,
  p_correlation_id uuid
)
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  event_id uuid;
  existing_event public.outbox_events%rowtype;
begin
  if p_event_type not in (
    'academic_record.anchor.requested.v1',
    'share_grant.create.requested.v1',
    'share_grant.revoke.requested.v1'
  )
    or p_aggregate_type not in ('academic_record_version', 'record_share_grant')
    or p_payload is null
    or p_idempotency_key is null
    or p_trace_id is null
    or p_correlation_id is null
    or not lozzi_private.m6_valid_outbox_payload(p_event_type, p_payload)
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid Milestone 6 outbox event';
  end if;

  insert into public.outbox_events (
    institution_id,
    aggregate_type,
    aggregate_id,
    event_type,
    schema_version,
    payload,
    idempotency_key,
    trace_id,
    correlation_id
  )
  values (
    p_institution_id,
    p_aggregate_type,
    p_aggregate_id,
    p_event_type,
    1,
    p_payload,
    p_idempotency_key,
    p_trace_id,
    p_correlation_id
  )
  on conflict (event_type, aggregate_id) do nothing
  returning id into event_id;

  if event_id is not null then
    return event_id;
  end if;

  select event.*
  into existing_event
  from public.outbox_events event
  where event.event_type = p_event_type
    and event.aggregate_id = p_aggregate_id
  for update;

  if existing_event.id is null
    or existing_event.institution_id <> p_institution_id
    or existing_event.aggregate_type <> p_aggregate_type
    or existing_event.schema_version <> 1
    or existing_event.payload <> p_payload
  then
    raise exception using
      errcode = '23505',
      message = 'Conflicting Milestone 6 logical event';
  end if;

  return existing_event.id;
end;
$$;

revoke all on function lozzi_private.m6_has_exact_jsonb_keys(jsonb, text[])
  from public, anon, authenticated, service_role;
revoke all on function lozzi_private.m6_valid_commitment_identity_payload(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function lozzi_private.m6_valid_share_scopes(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function lozzi_private.m6_valid_outbox_payload(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function lozzi_private.enqueue_m6_outbox_event(
  uuid,
  text,
  uuid,
  text,
  jsonb,
  uuid,
  uuid,
  uuid
) from public, anon, authenticated, service_role;

create function public.publish_grade_submission_with_anchor(
  p_grade_submission_id uuid,
  p_content_commitment bytea,
  p_salt_reference text,
  p_idempotency_key uuid,
  p_commitment_environment text,
  p_institution_commitment bytea,
  p_institution_commitment_key_version integer,
  p_student_commitment bytea,
  p_student_commitment_key_version integer,
  p_trace_id uuid,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  publication_result jsonb;
  target_version public.academic_record_versions%rowtype;
  updated_version_id uuid;
  event_payload jsonb;
begin
  if p_commitment_environment not in (
    'development',
    'test',
    'staging',
    'production'
  )
    or p_institution_commitment is null
    or octet_length(p_institution_commitment) <> 32
    or p_institution_commitment_key_version is null
    or p_institution_commitment_key_version <= 0
    or p_student_commitment is null
    or octet_length(p_student_commitment) <> 32
    or p_student_commitment_key_version is null
    or p_student_commitment_key_version <= 0
    or p_trace_id is null
    or p_correlation_id is null
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid anchoring commitment identity';
  end if;

  publication_result := public.publish_grade_submission(
    p_grade_submission_id,
    p_content_commitment,
    p_salt_reference,
    p_idempotency_key
  );

  select version.*
  into target_version
  from public.academic_record_versions version
  where version.id = (publication_result ->> 'academicRecordVersionId')::uuid
  for update;

  if target_version.id is null
    or target_version.content_commitment <> p_content_commitment
  then
    raise exception using
      errcode = '55000',
      message = 'Published academic record version could not be reconciled';
  end if;

  update public.academic_record_versions version
  set
    commitment_environment = p_commitment_environment,
    institution_commitment = p_institution_commitment,
    institution_commitment_algorithm = 'lozzi-institution-v1',
    institution_commitment_key_version =
      p_institution_commitment_key_version,
    student_commitment = p_student_commitment,
    student_commitment_algorithm = 'lozzi-student-v1',
    student_commitment_key_version = p_student_commitment_key_version
  where version.id = target_version.id
    and (
      version.institution_commitment is null
      or (
        version.commitment_environment = p_commitment_environment
        and version.institution_commitment = p_institution_commitment
        and version.institution_commitment_key_version =
          p_institution_commitment_key_version
        and version.student_commitment = p_student_commitment
        and version.student_commitment_key_version =
          p_student_commitment_key_version
      )
    )
  returning version.id into updated_version_id;

  if updated_version_id is null then
    raise exception using
      errcode = '23505',
      message = 'Conflicting academic record commitment identity';
  end if;

  event_payload := jsonb_build_object(
    'academicRecordVersionId', target_version.id,
    'commitmentEnvironment', p_commitment_environment,
    'institutionCommitment',
      '0x' || encode(p_institution_commitment, 'hex'),
    'institutionCommitmentAlgorithm', 'lozzi-institution-v1',
    'institutionCommitmentKeyVersion',
      p_institution_commitment_key_version,
    'recordCommitment', '0x' || encode(p_content_commitment, 'hex'),
    'recordCommitmentAlgorithm', 'lozzi-rfc8785-v1',
    'studentCommitment', '0x' || encode(p_student_commitment, 'hex'),
    'studentCommitmentAlgorithm', 'lozzi-student-v1',
    'studentCommitmentKeyVersion', p_student_commitment_key_version
  );

  perform lozzi_private.enqueue_m6_outbox_event(
    target_version.institution_id,
    'academic_record_version',
    target_version.id,
    'academic_record.anchor.requested.v1',
    event_payload,
    p_idempotency_key,
    p_trace_id,
    p_correlation_id
  );

  return publication_result;
end;
$$;

create function public.activate_sensitive_share_with_outbox(
  p_draft_id uuid,
  p_token_hash bytea,
  p_grant_commitment bytea,
  p_commitment_environment text,
  p_institution_commitment bytea,
  p_institution_commitment_key_version integer,
  p_student_commitment bytea,
  p_student_commitment_key_version integer,
  p_trace_id uuid,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  draft_row public.record_share_drafts%rowtype;
  activation_result jsonb;
  grant_row public.record_share_grants%rowtype;
  updated_grant_id uuid;
  event_payload jsonb;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_commitment_environment not in (
    'development',
    'test',
    'staging',
    'production'
  )
    or p_institution_commitment is null
    or octet_length(p_institution_commitment) <> 32
    or p_institution_commitment_key_version is null
    or p_institution_commitment_key_version <= 0
    or p_student_commitment is null
    or octet_length(p_student_commitment) <> 32
    or p_student_commitment_key_version is null
    or p_student_commitment_key_version <= 0
    or p_trace_id is null
    or p_correlation_id is null
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid sharing commitment identity';
  end if;

  select draft.*
  into draft_row
  from public.record_share_drafts draft
  join public.students student on student.id = draft.student_id
  where draft.id = p_draft_id
    and student.user_id = caller_id
    and student.institution_id = draft.institution_id
  for update of draft;

  if draft_row.id is null then
    raise exception using
      errcode = '42501',
      message = 'Authorized share draft not found';
  end if;

  if draft_row.status = 'active'
    and draft_row.record_share_grant_id is not null
  then
    select grant_row_source.*
    into grant_row
    from public.record_share_grants grant_row_source
    where grant_row_source.id = draft_row.record_share_grant_id
    for update;

    if grant_row.id is null
      or grant_row.token_hash <> p_token_hash
      or grant_row.grant_commitment <> p_grant_commitment
    then
      raise exception using
        errcode = '23505',
        message = 'Conflicting share activation replay';
    end if;

    activation_result := jsonb_build_object(
      'draftId', draft_row.id,
      'shareGrantId', grant_row.id,
      'status', 'active',
      'expiresAt', grant_row.expires_at,
      'idempotentReplay', true
    );
  else
    activation_result := public.activate_sensitive_share(
      draft_row.id,
      draft_row.student_id,
      p_token_hash,
      p_grant_commitment
    );

    select grant_row_source.*
    into grant_row
    from public.record_share_grants grant_row_source
    where grant_row_source.id =
      (activation_result ->> 'shareGrantId')::uuid
    for update;
  end if;

  update public.record_share_grants share_grant
  set
    commitment_environment = p_commitment_environment,
    institution_commitment = p_institution_commitment,
    institution_commitment_algorithm = 'lozzi-institution-v1',
    institution_commitment_key_version =
      p_institution_commitment_key_version,
    student_commitment = p_student_commitment,
    student_commitment_algorithm = 'lozzi-student-v1',
    student_commitment_key_version = p_student_commitment_key_version
  where share_grant.id = grant_row.id
    and (
      share_grant.institution_commitment is null
      or (
        share_grant.commitment_environment = p_commitment_environment
        and share_grant.institution_commitment = p_institution_commitment
        and share_grant.institution_commitment_key_version =
          p_institution_commitment_key_version
        and share_grant.student_commitment = p_student_commitment
        and share_grant.student_commitment_key_version =
          p_student_commitment_key_version
      )
    )
  returning share_grant.id into updated_grant_id;

  if updated_grant_id is null then
    raise exception using
      errcode = '23505',
      message = 'Conflicting share commitment identity';
  end if;

  event_payload := jsonb_build_object(
    'academicRecordVersionId', grant_row.academic_record_version_id,
    'commitmentEnvironment', p_commitment_environment,
    'expiresAt', grant_row.expires_at,
    'grantCommitment', '0x' || encode(p_grant_commitment, 'hex'),
    'institutionCommitment',
      '0x' || encode(p_institution_commitment, 'hex'),
    'institutionCommitmentAlgorithm', 'lozzi-institution-v1',
    'institutionCommitmentKeyVersion',
      p_institution_commitment_key_version,
    'scopes', to_jsonb(grant_row.scopes),
    'shareGrantId', grant_row.id,
    'studentCommitment', '0x' || encode(p_student_commitment, 'hex'),
    'studentCommitmentAlgorithm', 'lozzi-student-v1',
    'studentCommitmentKeyVersion', p_student_commitment_key_version
  );

  perform lozzi_private.enqueue_m6_outbox_event(
    grant_row.institution_id,
    'record_share_grant',
    grant_row.id,
    'share_grant.create.requested.v1',
    event_payload,
    draft_row.idempotency_key,
    p_trace_id,
    p_correlation_id
  );

  return activation_result;
end;
$$;

create function public.revoke_sensitive_share_with_outbox(
  p_share_grant_id uuid,
  p_idempotency_key uuid,
  p_trace_id uuid,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  grant_row public.record_share_grants%rowtype;
  transitioned boolean := false;
  event_payload jsonb;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_idempotency_key is null
    or p_trace_id is null
    or p_correlation_id is null
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid share revocation request';
  end if;

  select share_grant.*
  into grant_row
  from public.record_share_grants share_grant
  join public.students student on student.id = share_grant.student_id
  where share_grant.id = p_share_grant_id
    and student.user_id = caller_id
    and student.institution_id = share_grant.institution_id
  for update of share_grant;

  if grant_row.id is null then
    raise exception using
      errcode = '42501',
      message = 'Authorized share grant not found';
  end if;

  if grant_row.institution_commitment is null
    or grant_row.student_commitment is null
  then
    raise exception using
      errcode = '55000',
      message = 'Share grant is not eligible for anchoring reconciliation';
  end if;

  if grant_row.status <> 'revoked' then
    update public.record_share_grants share_grant
    set
      status = 'revoked',
      revoked_at = now(),
      updated_at = now()
    where share_grant.id = grant_row.id
    returning share_grant.* into grant_row;
    transitioned := true;
  end if;

  event_payload := jsonb_build_object(
    'commitmentEnvironment', grant_row.commitment_environment,
    'grantCommitment', '0x' || encode(grant_row.grant_commitment, 'hex'),
    'institutionCommitment',
      '0x' || encode(grant_row.institution_commitment, 'hex'),
    'institutionCommitmentAlgorithm',
      grant_row.institution_commitment_algorithm,
    'institutionCommitmentKeyVersion',
      grant_row.institution_commitment_key_version,
    'revokedAt', grant_row.revoked_at,
    'shareGrantId', grant_row.id,
    'studentCommitment',
      '0x' || encode(grant_row.student_commitment, 'hex'),
    'studentCommitmentAlgorithm', grant_row.student_commitment_algorithm,
    'studentCommitmentKeyVersion',
      grant_row.student_commitment_key_version
  );

  perform lozzi_private.enqueue_m6_outbox_event(
    grant_row.institution_id,
    'record_share_grant',
    grant_row.id,
    'share_grant.revoke.requested.v1',
    event_payload,
    p_idempotency_key,
    p_trace_id,
    p_correlation_id
  );

  if transitioned then
    insert into public.audit_events (
      institution_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      outcome,
      metadata,
      correlation_id
    )
    values (
      grant_row.institution_id,
      caller_id,
      'share.sensitive.revoke',
      'record_share_grant',
      grant_row.id,
      'success',
      jsonb_build_object(
        'revokedAt', grant_row.revoked_at,
        'scopes', grant_row.scopes
      ),
      p_correlation_id
    );
  end if;

  return jsonb_build_object(
    'shareGrantId', grant_row.id,
    'status', 'revoked',
    'revokedAt', grant_row.revoked_at,
    'idempotentReplay', not transitioned
  );
end;
$$;

revoke all on function public.publish_grade_submission(uuid, bytea, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.activate_sensitive_share(uuid, uuid, bytea, bytea)
  from public, anon, authenticated, service_role;

revoke all on function public.publish_grade_submission_with_anchor(
  uuid,
  bytea,
  text,
  uuid,
  text,
  bytea,
  integer,
  bytea,
  integer,
  uuid,
  uuid
) from public, anon, authenticated, service_role;
revoke all on function public.activate_sensitive_share_with_outbox(
  uuid,
  bytea,
  bytea,
  text,
  bytea,
  integer,
  bytea,
  integer,
  uuid,
  uuid
) from public, anon, authenticated, service_role;
revoke all on function public.revoke_sensitive_share_with_outbox(
  uuid,
  uuid,
  uuid,
  uuid
) from public, anon, authenticated, service_role;

grant execute on function public.publish_grade_submission_with_anchor(
  uuid,
  bytea,
  text,
  uuid,
  text,
  bytea,
  integer,
  bytea,
  integer,
  uuid,
  uuid
) to authenticated;
grant execute on function public.activate_sensitive_share_with_outbox(
  uuid,
  bytea,
  bytea,
  text,
  bytea,
  integer,
  bytea,
  integer,
  uuid,
  uuid
) to authenticated;
grant execute on function public.revoke_sensitive_share_with_outbox(
  uuid,
  uuid,
  uuid,
  uuid
) to authenticated;
