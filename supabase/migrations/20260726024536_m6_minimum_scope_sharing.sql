create function lozzi_private.m6_valid_share_scope_array(candidate text[])
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select
    cardinality(candidate) between 1 and 4
    and candidate <@ array[
      'program',
      'degree-progress',
      'record-summary',
      'full-record'
    ]::text[]
    and cardinality(candidate) = (
      select count(distinct scope_value)::integer
      from unnest(candidate) as scope_value
    )
$$;

revoke all on function lozzi_private.m6_valid_share_scope_array(text[])
  from public, anon, authenticated, service_role;

alter table public.record_share_drafts
  add column grant_duration_minutes integer not null default 30,
  drop constraint if exists record_share_drafts_scopes_check,
  add constraint record_share_drafts_scopes_check
    check (lozzi_private.m6_valid_share_scope_array(scopes)),
  add constraint record_share_drafts_grant_duration_check
    check (grant_duration_minutes in (10, 15, 30)),
  add constraint record_share_drafts_short_grant_check
    check (grant_expires_at <= created_at + interval '30 minutes');

alter table public.record_share_grants
  add column chain_status text not null default 'local_private',
  drop constraint if exists record_share_grants_scopes_check,
  add constraint record_share_grants_scopes_check
    check (lozzi_private.m6_valid_share_scope_array(scopes)),
  add constraint record_share_grants_chain_status_check
    check (
      chain_status in (
        'local_private',
        'anchoring_pending',
        'anchored',
        'anchor_failed',
        'revocation_pending',
        'revoked'
      )
    );

create function public.create_minimum_scope_share_draft(
  p_student_id uuid,
  p_academic_record_version_id uuid,
  p_recipient_label text,
  p_scopes text[],
  p_grant_duration_minutes integer,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_institution_id uuid;
  draft_row public.record_share_drafts%rowtype;
  draft_expiry timestamptz := now() + interval '30 minutes';
  grant_expiry timestamptz;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_recipient_label is null
    or char_length(trim(p_recipient_label)) not between 2 and 120
    or p_scopes is null
    or not lozzi_private.m6_valid_share_scope_array(p_scopes)
    or p_grant_duration_minutes not in (10, 15, 30)
    or p_idempotency_key is null
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid sensitive share draft';
  end if;

  grant_expiry := now() + make_interval(mins => p_grant_duration_minutes);

  select student.institution_id
  into target_institution_id
  from public.students student
  where student.id = p_student_id
    and student.user_id = caller_id
    and student.deactivated_at is null;

  if target_institution_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authorized student not found';
  end if;

  if not exists (
    select 1
    from public.academic_record_versions record_version
    where record_version.id = p_academic_record_version_id
      and record_version.student_id = p_student_id
      and record_version.institution_id = target_institution_id
      and record_version.status = 'published'
  ) then
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
    grant_duration_minutes,
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
    grant_expiry,
    p_grant_duration_minutes,
    p_idempotency_key,
    caller_id
  )
  on conflict (idempotency_key) do nothing
  returning * into draft_row;

  if draft_row.id is null then
    select draft.*
    into draft_row
    from public.record_share_drafts draft
    where draft.idempotency_key = p_idempotency_key
    for update;

    if draft_row.id is null
      or draft_row.student_id <> p_student_id
      or draft_row.created_by <> caller_id
      or draft_row.academic_record_version_id <>
        p_academic_record_version_id
      or draft_row.recipient_label <> trim(p_recipient_label)
      or draft_row.scopes <> p_scopes
      or draft_row.grant_duration_minutes <> p_grant_duration_minutes
    then
      raise exception using
        errcode = '23505',
        message = 'Conflicting sensitive share draft replay';
    end if;
  end if;

  return jsonb_build_object(
    'draftId', draft_row.id,
    'draftExpiresAt', draft_row.draft_expires_at,
    'grantExpiresAt', draft_row.grant_expires_at,
    'grantDurationMinutes', draft_row.grant_duration_minutes,
    'scopes', to_jsonb(draft_row.scopes),
    'status', draft_row.status
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
) from public, anon, authenticated, service_role;
revoke all on function public.create_minimum_scope_share_draft(
  uuid,
  uuid,
  text,
  text[],
  integer,
  uuid
) from public, anon, service_role;
grant execute on function public.create_minimum_scope_share_draft(
  uuid,
  uuid,
  text,
  text[],
  integer,
  uuid
) to authenticated;
