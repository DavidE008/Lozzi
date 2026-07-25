create table public.agent_delegations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  scopes text[] not null check (
    scopes @> array['degree-plan:read', 'degree-plan:propose']::text[]
    and scopes <@ array['degree-plan:read', 'degree-plan:propose']::text[]
  ),
  used_scopes text[] not null default '{}' check (
    used_scopes <@ array['degree-plan:read', 'degree-plan:propose']::text[]
  ),
  human_id_commitment bytea check (
    human_id_commitment is null
    or octet_length(human_id_commitment) = 32
  ),
  agent_address_commitment bytea check (
    agent_address_commitment is null
    or octet_length(agent_address_commitment) = 32
  ),
  status text not null default 'active' check (
    status in ('active', 'consumed', 'revoked', 'expired')
  ),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  check (expires_at > created_at),
  check (expires_at <= created_at + interval '30 minutes'),
  check (status <> 'consumed' or consumed_at is not null),
  check (status <> 'revoked' or revoked_at is not null)
);

create table public.agentkit_usage (
  endpoint text not null check (
    endpoint in (
      '/api/agentkit/degree-plan/context',
      '/api/agentkit/degree-plan/proposals'
    )
  ),
  human_id_commitment bytea not null check (
    octet_length(human_id_commitment) = 32
  ),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  usage_count integer not null default 0 check (usage_count between 0 and 3),
  first_used_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  primary key (endpoint, human_id_commitment)
);

create table public.agentkit_nonces (
  nonce_hash bytea primary key check (octet_length(nonce_hash) = 32),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  delegation_id uuid not null references public.agent_delegations(id) on delete restrict,
  endpoint text not null check (
    endpoint in (
      '/api/agentkit/degree-plan/context',
      '/api/agentkit/degree-plan/proposals'
    )
  ),
  human_id_commitment bytea not null check (
    octet_length(human_id_commitment) = 32
  ),
  expires_at timestamptz not null,
  used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.degree_plan_proposals (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  delegation_id uuid not null unique references public.agent_delegations(id) on delete restrict,
  submitted_by_human_commitment bytea not null check (
    octet_length(submitted_by_human_commitment) = 32
  ),
  summary text not null check (char_length(summary) between 1 and 1200),
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'withdrawn')
  ),
  reviewed_by_role_assignment_id uuid references public.staff_role_assignments(id) on delete restrict,
  review_note text check (
    review_note is null
    or char_length(review_note) between 1 and 1200
  ),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status = 'pending'
    or status = 'withdrawn'
    or (
      reviewed_by_role_assignment_id is not null
      and reviewed_at is not null
    )
  )
);

create table public.degree_plan_proposal_items (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  proposal_id uuid not null references public.degree_plan_proposals(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  course_code text not null check (char_length(course_code) between 1 and 40),
  sort_order integer not null check (sort_order between 1 and 12),
  created_at timestamptz not null default now(),
  unique (proposal_id, course_id),
  unique (proposal_id, sort_order)
);

create index agent_delegations_student_recent_idx
  on public.agent_delegations (student_id, created_at desc);
create index agent_delegations_expiry_idx
  on public.agent_delegations (expires_at)
  where status = 'active';
create index agentkit_usage_student_idx
  on public.agentkit_usage (student_id, last_used_at desc);
create index agentkit_nonces_student_idx
  on public.agentkit_nonces (student_id, used_at desc);
create index degree_plan_proposals_advisor_queue_idx
  on public.degree_plan_proposals (institution_id, status, submitted_at);
create index degree_plan_proposals_student_idx
  on public.degree_plan_proposals (student_id, submitted_at desc);
create index degree_plan_proposal_items_proposal_idx
  on public.degree_plan_proposal_items (proposal_id, sort_order);

create trigger set_agent_delegations_updated_at
before update on public.agent_delegations
for each row execute function lozzi_private.set_updated_at();

create trigger set_degree_plan_proposals_updated_at
before update on public.degree_plan_proposals
for each row execute function lozzi_private.set_updated_at();

create function lozzi_private.enforce_degree_plan_proposal_immutability()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if new.institution_id <> old.institution_id
    or new.student_id <> old.student_id
    or new.delegation_id <> old.delegation_id
    or new.submitted_by_human_commitment <> old.submitted_by_human_commitment
    or new.summary <> old.summary
    or new.submitted_at <> old.submitted_at
    or new.created_at <> old.created_at
  then
    raise exception using
      errcode = '22023',
      message = 'Degree-plan proposal content is immutable';
  end if;
  return new;
end;
$$;

create trigger enforce_degree_plan_proposal_immutability
before update on public.degree_plan_proposals
for each row execute function lozzi_private.enforce_degree_plan_proposal_immutability();

create function lozzi_private.is_course_eligible_for_student(
  target_student_id uuid,
  target_course_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with active_program as (
    select student_program.program_version_id
    from public.student_programs student_program
    where student_program.student_id = target_student_id
      and student_program.status = 'active'
    order by student_program.assigned_at desc
    limit 1
  ),
  completed_courses as (
    select
      section.course_id,
      max(grade_record.grade_points) as grade_points
    from public.enrollments enrollment
    join public.course_sections section
      on section.id = enrollment.section_id
    join public.grade_records grade_record
      on grade_record.enrollment_id = enrollment.id
    where enrollment.student_id = target_student_id
      and enrollment.status = 'completed'
      and grade_record.is_current
      and grade_record.credit_hours_earned > 0
    group by section.course_id
  )
  select exists (
    select 1
    from public.program_requirements requirement
    join active_program
      on active_program.program_version_id = requirement.program_version_id
    where requirement.course_id = target_course_id
      and requirement.deactivated_at is null
      and not exists (
        select 1
        from completed_courses completed
        where completed.course_id = target_course_id
      )
      and not exists (
        select 1
        from public.enrollments current_enrollment
        join public.course_sections current_section
          on current_section.id = current_enrollment.section_id
        where current_enrollment.student_id = target_student_id
          and current_section.course_id = target_course_id
          and current_enrollment.status in ('pending', 'enrolled', 'waitlisted')
      )
      and not exists (
        select 1
        from public.course_prerequisites prerequisite
        where prerequisite.course_id = target_course_id
          and not exists (
            select 1
            from completed_courses completed
            where completed.course_id = prerequisite.prerequisite_course_id
              and completed.grade_points >= prerequisite.minimum_grade_points
          )
      )
  )
$$;

revoke all on function lozzi_private.enforce_degree_plan_proposal_immutability()
  from public, anon, authenticated;
revoke all on function lozzi_private.is_course_eligible_for_student(uuid, uuid)
  from public, anon, authenticated;
grant execute on function lozzi_private.enforce_degree_plan_proposal_immutability()
  to service_role;
grant execute on function lozzi_private.is_course_eligible_for_student(uuid, uuid)
  to service_role;

alter table public.agent_delegations enable row level security;
alter table public.agentkit_usage enable row level security;
alter table public.agentkit_nonces enable row level security;
alter table public.degree_plan_proposals enable row level security;
alter table public.degree_plan_proposal_items enable row level security;

create policy agent_delegations_authorized_select
on public.agent_delegations for select to authenticated
using (
  (select lozzi_private.is_student_self(student_id))
  or (
    select lozzi_private.has_membership(
      institution_id,
      array['registrar', 'institution_admin']
    )
  )
);

create policy agentkit_usage_authorized_select
on public.agentkit_usage for select to authenticated
using (
  (select lozzi_private.is_student_self(student_id))
  or (
    select lozzi_private.has_membership(
      institution_id,
      array['registrar', 'institution_admin']
    )
  )
);

create policy agentkit_nonces_authorized_select
on public.agentkit_nonces for select to authenticated
using (
  (select lozzi_private.is_student_self(student_id))
  or (
    select lozzi_private.has_membership(
      institution_id,
      array['registrar', 'institution_admin']
    )
  )
);

create policy degree_plan_proposals_authorized_select
on public.degree_plan_proposals for select to authenticated
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

create policy degree_plan_proposal_items_authorized_select
on public.degree_plan_proposal_items for select to authenticated
using (
  exists (
    select 1
    from public.degree_plan_proposals proposal
    where proposal.id = degree_plan_proposal_items.proposal_id
      and (
        (select lozzi_private.is_student_self(proposal.student_id))
        or (select lozzi_private.is_assigned_advisor(proposal.student_id))
        or (
          select lozzi_private.has_membership(
            proposal.institution_id,
            array['registrar', 'institution_admin']
          )
        )
      )
  )
);

revoke all on table public.agent_delegations
  from public, anon, authenticated, service_role;
revoke all on table public.agentkit_usage
  from public, anon, authenticated, service_role;
revoke all on table public.agentkit_nonces
  from public, anon, authenticated, service_role;
revoke all on table public.degree_plan_proposals
  from public, anon, authenticated, service_role;
revoke all on table public.degree_plan_proposal_items
  from public, anon, authenticated, service_role;

grant select on table public.agent_delegations,
  public.agentkit_usage,
  public.agentkit_nonces,
  public.degree_plan_proposals,
  public.degree_plan_proposal_items
to authenticated;

grant select, insert, update on table public.agent_delegations
  to service_role;
grant select, insert, update on table public.agentkit_usage
  to service_role;
grant select, insert on table public.agentkit_nonces
  to service_role;
grant select, insert, update on table public.degree_plan_proposals
  to service_role;
grant select, insert on table public.degree_plan_proposal_items
  to service_role;

create function public.create_degree_plan_delegation(
  p_student_id uuid,
  p_token_hash bytea,
  p_expires_at timestamptz,
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
  delegation_id uuid;
begin
  if p_token_hash is null
    or octet_length(p_token_hash) <> 32
    or p_expires_at <= now()
    or p_expires_at > now() + interval '30 minutes'
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid degree-plan delegation';
  end if;

  select student.institution_id, student.user_id
  into target_institution_id, target_user_id
  from public.students student
  where student.id = p_student_id
    and student.deactivated_at is null;

  if target_institution_id is null then
    raise exception using
      errcode = '22023',
      message = 'Active student not found';
  end if;

  insert into public.agent_delegations (
    institution_id,
    student_id,
    token_hash,
    scopes,
    expires_at,
    idempotency_key,
    created_by
  )
  values (
    target_institution_id,
    p_student_id,
    p_token_hash,
    array['degree-plan:read', 'degree-plan:propose'],
    p_expires_at,
    p_idempotency_key,
    target_user_id
  )
  on conflict (idempotency_key)
  do update set idempotency_key = excluded.idempotency_key
  returning id into delegation_id;

  return jsonb_build_object(
    'delegationId', delegation_id,
    'expiresAt', p_expires_at,
    'scopes', array['degree-plan:read', 'degree-plan:propose'],
    'status', 'active'
  );
end;
$$;

create function public.authorize_agent_delegation_scope(
  p_token_hash bytea,
  p_scope text,
  p_endpoint text,
  p_human_id_commitment bytea,
  p_agent_address_commitment bytea,
  p_nonce_hash bytea,
  p_nonce_expires_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  delegation_row public.agent_delegations%rowtype;
  next_usage_count integer;
begin
  if p_token_hash is null
    or octet_length(p_token_hash) <> 32
    or p_human_id_commitment is null
    or octet_length(p_human_id_commitment) <> 32
    or p_agent_address_commitment is null
    or octet_length(p_agent_address_commitment) <> 32
    or p_nonce_hash is null
    or octet_length(p_nonce_hash) <> 32
    or p_nonce_expires_at <= now()
    or p_nonce_expires_at > now() + interval '10 minutes'
    or not (
      (
        p_scope = 'degree-plan:read'
        and p_endpoint = '/api/agentkit/degree-plan/context'
      )
      or (
        p_scope = 'degree-plan:propose'
        and p_endpoint = '/api/agentkit/degree-plan/proposals'
      )
    )
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid AgentKit authorization';
  end if;

  select *
  into delegation_row
  from public.agent_delegations delegation
  where delegation.token_hash = p_token_hash
  for update;

  if delegation_row.id is null
    or delegation_row.status <> 'active'
    or delegation_row.expires_at <= now()
    or not (p_scope = any (delegation_row.scopes))
    or p_scope = any (delegation_row.used_scopes)
    or (
      delegation_row.human_id_commitment is not null
      and delegation_row.human_id_commitment <> p_human_id_commitment
    )
    or (
      delegation_row.agent_address_commitment is not null
      and delegation_row.agent_address_commitment <> p_agent_address_commitment
    )
  then
    raise exception using
      errcode = '42501',
      message = 'Delegation is invalid, expired, or already used';
  end if;

  insert into public.agentkit_nonces (
    nonce_hash,
    institution_id,
    student_id,
    delegation_id,
    endpoint,
    human_id_commitment,
    expires_at
  )
  values (
    p_nonce_hash,
    delegation_row.institution_id,
    delegation_row.student_id,
    delegation_row.id,
    p_endpoint,
    p_human_id_commitment,
    p_nonce_expires_at
  );

  insert into public.agentkit_usage (
    endpoint,
    human_id_commitment,
    institution_id,
    student_id,
    usage_count
  )
  values (
    p_endpoint,
    p_human_id_commitment,
    delegation_row.institution_id,
    delegation_row.student_id,
    1
  )
  on conflict (endpoint, human_id_commitment)
  do update set
    usage_count = public.agentkit_usage.usage_count + 1,
    last_used_at = now()
  where public.agentkit_usage.usage_count < 3
    and public.agentkit_usage.student_id = excluded.student_id
    and public.agentkit_usage.institution_id = excluded.institution_id
  returning usage_count into next_usage_count;

  if next_usage_count is null then
    raise exception using
      errcode = 'P0001',
      message = 'AgentKit free-trial usage limit reached';
  end if;

  update public.agent_delegations
  set
    human_id_commitment = p_human_id_commitment,
    agent_address_commitment = p_agent_address_commitment,
    used_scopes = array_append(used_scopes, p_scope),
    status = case
      when cardinality(array_append(used_scopes, p_scope)) = cardinality(scopes)
        then 'consumed'
      else status
    end,
    consumed_at = case
      when cardinality(array_append(used_scopes, p_scope)) = cardinality(scopes)
        then now()
      else consumed_at
    end
  where id = delegation_row.id;

  return jsonb_build_object(
    'delegationId', delegation_row.id,
    'studentId', delegation_row.student_id,
    'institutionId', delegation_row.institution_id,
    'scope', p_scope,
    'usageCount', next_usage_count,
    'usageLimit', 3
  );
exception
  when unique_violation then
    raise exception using
      errcode = '23505',
      message = 'AgentKit nonce replay detected';
end;
$$;

create function public.get_agent_degree_plan_context(
  p_delegation_id uuid,
  p_student_id uuid,
  p_human_id_commitment bytea
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with authorized as (
    select delegation.student_id
    from public.agent_delegations delegation
    where delegation.id = p_delegation_id
      and delegation.student_id = p_student_id
      and delegation.human_id_commitment = p_human_id_commitment
      and 'degree-plan:read' = any (delegation.used_scopes)
      and delegation.expires_at > now()
  ),
  active_program as (
    select student_program.program_version_id
    from public.student_programs student_program
    join authorized on authorized.student_id = student_program.student_id
    where student_program.status = 'active'
    order by student_program.assigned_at desc
    limit 1
  ),
  completed_courses as (
    select distinct section.course_id
    from public.enrollments enrollment
    join authorized on authorized.student_id = enrollment.student_id
    join public.course_sections section
      on section.id = enrollment.section_id
    join public.grade_records grade_record
      on grade_record.enrollment_id = enrollment.id
    where enrollment.status = 'completed'
      and grade_record.is_current
      and grade_record.credit_hours_earned > 0
  ),
  requirements as (
    select
      course.code,
      exists (
        select 1
        from completed_courses completed
        where completed.course_id = course.id
      ) as completed,
      lozzi_private.is_course_eligible_for_student(p_student_id, course.id) as eligible
    from public.program_requirements requirement
    join active_program
      on active_program.program_version_id = requirement.program_version_id
    join public.courses course
      on course.id = requirement.course_id
    where course.deactivated_at is null
      and requirement.deactivated_at is null
    order by requirement.sort_order, course.code
  )
  select jsonb_build_object(
    'requirements',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'courseCode', requirements.code,
          'completed', requirements.completed,
          'eligible', requirements.eligible
        )
        order by requirements.code
      ),
      '[]'::jsonb
    )
  )
  from requirements
$$;

create function public.submit_degree_plan_proposal(
  p_delegation_id uuid,
  p_student_id uuid,
  p_human_id_commitment bytea,
  p_summary text,
  p_course_ids uuid[]
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  delegation_row public.agent_delegations%rowtype;
  proposal_id uuid;
  requested_course_id uuid;
  requested_course_code text;
  requested_sort_order integer := 0;
begin
  if p_summary is null
    or char_length(trim(p_summary)) not between 1 and 1200
    or p_course_ids is null
    or cardinality(p_course_ids) not between 1 and 12
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid degree-plan proposal';
  end if;

  select *
  into delegation_row
  from public.agent_delegations delegation
  where delegation.id = p_delegation_id
    and delegation.student_id = p_student_id
    and delegation.human_id_commitment = p_human_id_commitment
    and 'degree-plan:propose' = any (delegation.used_scopes)
    and delegation.expires_at > now();

  if delegation_row.id is null then
    raise exception using
      errcode = '42501',
      message = 'Degree-plan proposal delegation not found';
  end if;

  foreach requested_course_id in array p_course_ids loop
    if not lozzi_private.is_course_eligible_for_student(
      p_student_id,
      requested_course_id
    ) then
      raise exception using
        errcode = '22023',
        message = 'Proposal contains an ineligible course';
    end if;
  end loop;

  insert into public.degree_plan_proposals (
    institution_id,
    student_id,
    delegation_id,
    submitted_by_human_commitment,
    summary
  )
  values (
    delegation_row.institution_id,
    delegation_row.student_id,
    delegation_row.id,
    p_human_id_commitment,
    trim(p_summary)
  )
  returning id into proposal_id;

  foreach requested_course_id in array p_course_ids loop
    requested_sort_order := requested_sort_order + 1;
    select course.code
    into requested_course_code
    from public.courses course
    where course.id = requested_course_id
      and course.institution_id = delegation_row.institution_id
      and course.deactivated_at is null;

    insert into public.degree_plan_proposal_items (
      institution_id,
      proposal_id,
      course_id,
      course_code,
      sort_order
    )
    values (
      delegation_row.institution_id,
      proposal_id,
      requested_course_id,
      requested_course_code,
      requested_sort_order
    );
  end loop;

  insert into public.audit_events (
    institution_id,
    action,
    entity_type,
    entity_id,
    outcome,
    metadata
  )
  values (
    delegation_row.institution_id,
    'degree_plan.proposal.submit',
    'degree_plan_proposal',
    proposal_id,
    'success',
    jsonb_build_object(
      'courseCount', cardinality(p_course_ids),
      'reviewRequired', true
    )
  );

  return jsonb_build_object(
    'proposalId', proposal_id,
    'status', 'pending',
    'reviewRequired', true
  );
exception
  when unique_violation then
    raise exception using
      errcode = '23505',
      message = 'Degree-plan delegation already submitted a proposal';
end;
$$;

create function public.review_degree_plan_proposal(
  p_proposal_id uuid,
  p_decision text,
  p_review_note text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  proposal_row public.degree_plan_proposals%rowtype;
  advisor_role_id uuid;
begin
  if auth.uid() is null
    or p_decision not in ('approved', 'rejected')
    or p_review_note is null
    or char_length(trim(p_review_note)) not between 1 and 1200
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid advisor decision';
  end if;

  select *
  into proposal_row
  from public.degree_plan_proposals proposal
  where proposal.id = p_proposal_id
  for update;

  select staff_role.id
  into advisor_role_id
  from public.advisor_assignments assignment
  join public.staff_role_assignments staff_role
    on staff_role.id = assignment.advisor_role_assignment_id
  where assignment.student_id = proposal_row.student_id
    and assignment.status = 'active'
    and assignment.deactivated_at is null
    and (assignment.ends_at is null or assignment.ends_at > now())
    and staff_role.user_id = auth.uid()
    and staff_role.role = 'advisor'
    and staff_role.status = 'active'
    and staff_role.deactivated_at is null
  limit 1;

  if proposal_row.id is null
    or proposal_row.status <> 'pending'
    or advisor_role_id is null
  then
    raise exception using
      errcode = '42501',
      message = 'Pending assigned proposal not found';
  end if;

  update public.degree_plan_proposals
  set
    status = p_decision,
    reviewed_by_role_assignment_id = advisor_role_id,
    review_note = trim(p_review_note),
    reviewed_at = now()
  where id = proposal_row.id;

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
    proposal_row.institution_id,
    auth.uid(),
    'degree_plan.proposal.review',
    'degree_plan_proposal',
    proposal_row.id,
    'success',
    jsonb_build_object('decision', p_decision)
  );

  return jsonb_build_object(
    'proposalId', proposal_row.id,
    'status', p_decision,
    'reviewedAt', now()
  );
end;
$$;

revoke all on function public.create_degree_plan_delegation(
  uuid,
  bytea,
  timestamptz,
  uuid
) from public, anon, authenticated;
revoke all on function public.authorize_agent_delegation_scope(
  bytea,
  text,
  text,
  bytea,
  bytea,
  bytea,
  timestamptz
) from public, anon, authenticated;
revoke all on function public.get_agent_degree_plan_context(
  uuid,
  uuid,
  bytea
) from public, anon, authenticated;
revoke all on function public.submit_degree_plan_proposal(
  uuid,
  uuid,
  bytea,
  text,
  uuid[]
) from public, anon, authenticated;
revoke all on function public.review_degree_plan_proposal(
  uuid,
  text,
  text
) from public, anon;

grant execute on function public.create_degree_plan_delegation(
  uuid,
  bytea,
  timestamptz,
  uuid
) to service_role;
grant execute on function public.authorize_agent_delegation_scope(
  bytea,
  text,
  text,
  bytea,
  bytea,
  bytea,
  timestamptz
) to service_role;
grant execute on function public.get_agent_degree_plan_context(
  uuid,
  uuid,
  bytea
) to service_role;
grant execute on function public.submit_degree_plan_proposal(
  uuid,
  uuid,
  bytea,
  text,
  uuid[]
) to service_role;
grant execute on function public.review_degree_plan_proposal(
  uuid,
  text,
  text
) to authenticated, service_role;
