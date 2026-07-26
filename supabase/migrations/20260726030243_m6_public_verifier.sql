create table lozzi_private.public_verifier_attempts (
  id bigint generated always as identity primary key,
  request_fingerprint_hash bytea not null
    check (octet_length(request_fingerprint_hash) = 32),
  outcome text not null check (
    outcome in ('allowed', 'expired', 'revoked', 'invalid')
  ),
  occurred_at timestamptz not null default now()
);

create index public_verifier_attempts_fingerprint_recent_idx
  on lozzi_private.public_verifier_attempts (
    request_fingerprint_hash,
    occurred_at desc
  );

revoke all on table lozzi_private.public_verifier_attempts
  from public, anon, authenticated, service_role;
revoke all on sequence lozzi_private.public_verifier_attempts_id_seq
  from public, anon, authenticated, service_role;

create function lozzi_private.build_m6_share_disclosure(
  p_student_id uuid,
  p_academic_record_version_id uuid,
  p_scopes text[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  disclosure jsonb := '{}'::jsonb;
  program_payload jsonb;
  progress_payload jsonb;
  record_payload jsonb;
begin
  if not lozzi_private.m6_valid_share_scope_array(p_scopes)
    or not exists (
      select 1
      from public.academic_record_versions record_version
      where record_version.id = p_academic_record_version_id
        and record_version.student_id = p_student_id
        and record_version.status in ('published', 'superseded')
    )
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid share disclosure source';
  end if;

  if 'program' = any (p_scopes) then
    select jsonb_build_object(
      'credentialType', program.credential_type,
      'name', program.name
    )
    into program_payload
    from public.student_programs student_program
    join public.program_versions program_version
      on program_version.id = student_program.program_version_id
    join public.programs program
      on program.id = program_version.program_id
    where student_program.student_id = p_student_id
      and student_program.status in ('active', 'completed')
    order by
      case when student_program.status = 'active' then 0 else 1 end,
      student_program.assigned_at desc
    limit 1;

    if program_payload is null then
      raise exception using
        errcode = '22023',
        message = 'Selected program disclosure is unavailable';
    end if;

    disclosure := disclosure || jsonb_build_object(
      'program',
      program_payload
    );
  end if;

  if 'degree-progress' = any (p_scopes) then
    select jsonb_build_object(
      'calculatedAt', audit.calculated_at,
      'creditsEarned', audit.credits_earned,
      'creditsRequired', audit.credits_required,
      'progressPercent', audit.progress_percent
    )
    into progress_payload
    from public.degree_audit_snapshots audit
    where audit.student_id = p_student_id
      and audit.academic_record_version_id = p_academic_record_version_id
    order by audit.calculated_at desc
    limit 1;

    if progress_payload is null then
      raise exception using
        errcode = '22023',
        message = 'Selected degree-progress disclosure is unavailable';
    end if;

    disclosure := disclosure || jsonb_build_object(
      'degree-progress',
      progress_payload
    );
  end if;

  if 'record-summary' = any (p_scopes) then
    select jsonb_build_object(
      'courseCount', count(*)::integer,
      'creditsEarned', coalesce(sum(grade.credit_hours_earned), 0),
      'latestPublishedAt', max(grade.published_at)
    )
    into record_payload
    from public.grade_records grade
    join public.enrollments enrollment
      on enrollment.id = grade.enrollment_id
    where enrollment.student_id = p_student_id
      and grade.is_current;

    disclosure := disclosure || jsonb_build_object(
      'record-summary',
      record_payload
    );
  end if;

  if 'full-record' = any (p_scopes) then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'courseCode', course.code,
          'courseTitle', course.title,
          'creditHoursEarned', grade.credit_hours_earned,
          'gradeCode', grade.grade_code,
          'publishedAt', grade.published_at
        )
        order by grade.published_at desc, course.code
      ),
      '[]'::jsonb
    )
    into record_payload
    from public.grade_records grade
    join public.enrollments enrollment
      on enrollment.id = grade.enrollment_id
    join public.course_sections section
      on section.id = enrollment.section_id
    join public.courses course
      on course.id = section.course_id
    where enrollment.student_id = p_student_id
      and grade.is_current;

    disclosure := disclosure || jsonb_build_object(
      'full-record',
      record_payload
    );
  end if;

  return disclosure;
end;
$$;

create function lozzi_private.m6_valid_share_disclosure(
  p_scopes text[],
  p_disclosure jsonb
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select
    jsonb_typeof(p_disclosure) = 'object'
    and (
      select count(*) = cardinality(p_scopes)
      from jsonb_object_keys(p_disclosure)
    )
    and not exists (
      select 1
      from jsonb_object_keys(p_disclosure) as disclosure_key
      where not (disclosure_key = any (p_scopes))
    )
$$;

revoke all on function lozzi_private.build_m6_share_disclosure(
  uuid,
  uuid,
  text[]
) from public, anon, authenticated, service_role;
revoke all on function lozzi_private.m6_valid_share_disclosure(text[], jsonb)
  from public, anon, authenticated, service_role;

alter table public.record_share_grants
  add column disclosure_payload jsonb not null default '{}'::jsonb;

update public.record_share_grants share_grant
set disclosure_payload = lozzi_private.build_m6_share_disclosure(
  share_grant.student_id,
  share_grant.academic_record_version_id,
  share_grant.scopes
);

alter table public.record_share_grants
  add constraint record_share_grants_disclosure_payload_check
    check (
      lozzi_private.m6_valid_share_disclosure(
        scopes,
        disclosure_payload
      )
    );

create function lozzi_private.set_m6_share_disclosure()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  new.disclosure_payload := lozzi_private.build_m6_share_disclosure(
    new.student_id,
    new.academic_record_version_id,
    new.scopes
  );
  return new;
end;
$$;

create trigger set_m6_share_disclosure
before insert on public.record_share_grants
for each row execute function lozzi_private.set_m6_share_disclosure();

create function lozzi_private.prevent_m6_share_disclosure_expansion()
returns trigger
language plpgsql
volatile
set search_path = ''
as $$
begin
  if new.student_id <> old.student_id
    or new.academic_record_version_id <> old.academic_record_version_id
    or new.scopes <> old.scopes
    or new.disclosure_payload <> old.disclosure_payload
  then
    raise exception using
      errcode = '23514',
      message = 'Activated share disclosure is immutable';
  end if;
  return new;
end;
$$;

create trigger prevent_m6_share_disclosure_expansion
before update on public.record_share_grants
for each row execute function
  lozzi_private.prevent_m6_share_disclosure_expansion();

revoke all on function lozzi_private.set_m6_share_disclosure()
  from public, anon, authenticated, service_role;
revoke all on function lozzi_private.prevent_m6_share_disclosure_expansion()
  from public, anon, authenticated, service_role;

create function public.verify_record_share(
  p_token_hash bytea,
  p_request_fingerprint_hash bytea
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  recent_attempts integer;
  grant_row public.record_share_grants%rowtype;
  version_row public.academic_record_versions%rowtype;
  institution_row public.institutions%rowtype;
  public_status text;
  access_result text;
begin
  if p_token_hash is null
    or octet_length(p_token_hash) <> 32
    or p_request_fingerprint_hash is null
    or octet_length(p_request_fingerprint_hash) <> 32
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid verifier request';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      pg_catalog.encode(p_request_fingerprint_hash, 'hex'),
      0
    )
  );

  select count(*)::integer
  into recent_attempts
  from lozzi_private.public_verifier_attempts attempt
  where attempt.request_fingerprint_hash = p_request_fingerprint_hash
    and attempt.occurred_at > now() - interval '5 minutes';

  if recent_attempts >= 20 then
    raise exception using
      errcode = 'P0001',
      message = 'Public verifier rate limit exceeded';
  end if;

  select share_grant.*
  into grant_row
  from public.record_share_grants share_grant
  where share_grant.token_hash = p_token_hash;

  if grant_row.id is null then
    insert into lozzi_private.public_verifier_attempts (
      request_fingerprint_hash,
      outcome
    )
    values (p_request_fingerprint_hash, 'invalid');

    return jsonb_build_object('status', 'invalid');
  end if;

  select record_version.*
  into version_row
  from public.academic_record_versions record_version
  where record_version.id = grant_row.academic_record_version_id;

  select institution.*
  into institution_row
  from public.institutions institution
  where institution.id = grant_row.institution_id;

  if grant_row.status = 'revoked' or grant_row.revoked_at is not null then
    public_status := 'revoked';
    access_result := 'denied_revoked';
  elsif grant_row.status = 'expired' or grant_row.expires_at <= now() then
    public_status := 'expired';
    access_result := 'denied_expired';
  elsif grant_row.status <> 'active' then
    public_status := 'invalid';
    access_result := 'denied_invalid';
  elsif grant_row.chain_status = 'anchored'
    and version_row.anchor_status = 'confirmed'
  then
    public_status := 'chain_check_required';
    access_result := 'allowed';
  elsif grant_row.chain_status in (
    'anchoring_pending',
    'revocation_pending'
  )
    or version_row.anchor_status = 'pending'
  then
    public_status := 'pending_anchor';
    access_result := 'allowed';
  elsif grant_row.chain_status = 'anchor_failed'
    or version_row.anchor_status = 'failed'
  then
    public_status := 'configuration_unavailable';
    access_result := 'allowed';
  else
    public_status := 'locally_verified';
    access_result := 'allowed';
  end if;

  insert into lozzi_private.public_verifier_attempts (
    request_fingerprint_hash,
    outcome
  )
  values (
    p_request_fingerprint_hash,
    case
      when public_status = 'revoked' then 'revoked'
      when public_status = 'expired' then 'expired'
      when access_result = 'allowed' then 'allowed'
      else 'invalid'
    end
  );

  insert into public.record_share_access_logs (
    institution_id,
    share_grant_id,
    access_result,
    requested_scopes,
    request_fingerprint_hash
  )
  values (
    grant_row.institution_id,
    grant_row.id,
    access_result,
    case when access_result = 'allowed' then grant_row.scopes else '{}'::text[] end,
    p_request_fingerprint_hash
  );

  if access_result <> 'allowed' then
    if public_status = 'invalid' then
      return jsonb_build_object('status', 'invalid');
    end if;

    return jsonb_build_object(
      'expiresAt', grant_row.expires_at,
      'issuer', jsonb_build_object('name', institution_row.name),
      'status', public_status
    );
  end if;

  return jsonb_build_object(
    'disclosure', grant_row.disclosure_payload,
    'expiresAt', grant_row.expires_at,
    'issuer', jsonb_build_object('name', institution_row.name),
    'record', jsonb_build_object(
      'anchorStatus', version_row.anchor_status,
      'commitment', '0x' || encode(version_row.content_commitment, 'hex'),
      'publishedAt', version_row.published_at,
      'versionNumber', version_row.version_number
    ),
    'registryEvidence', jsonb_build_object(
      'grantCommitment', case
        when grant_row.grant_commitment is null then null
        else '0x' || encode(grant_row.grant_commitment, 'hex')
      end,
      'institutionCommitment', case
        when grant_row.institution_commitment is null then null
        else '0x' || encode(grant_row.institution_commitment, 'hex')
      end,
      'recordCommitment', '0x' ||
        encode(version_row.content_commitment, 'hex'),
      'studentCommitment', case
        when grant_row.student_commitment is null then null
        else '0x' || encode(grant_row.student_commitment, 'hex')
      end
    ),
    'scopes', to_jsonb(grant_row.scopes),
    'status', public_status
  );
end;
$$;

revoke all on function public.verify_record_share(bytea, bytea)
  from public, anon, authenticated;
grant execute on function public.verify_record_share(bytea, bytea)
  to service_role;
