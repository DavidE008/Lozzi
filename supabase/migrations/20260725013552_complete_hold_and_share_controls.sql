create table if not exists public.student_holds (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  hold_type text not null,
  reason_code text not null,
  is_blocking boolean not null default true,
  status text not null default 'active' check (status in ('active', 'released')),
  placed_at timestamptz not null default now(),
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  check (status <> 'released' or released_at is not null)
);

create index if not exists student_holds_active_idx
  on public.student_holds (student_id, is_blocking)
  where status = 'active';

alter table public.student_holds enable row level security;
alter table public.student_holds force row level security;
revoke all on table public.student_holds from public, anon, authenticated, service_role;
grant all on table public.student_holds to service_role;
grant select on table public.student_holds to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'student_holds'
      and policyname = 'student_holds_authorized_select'
  ) then
    create policy student_holds_authorized_select
    on public.student_holds for select to authenticated
    using (lozzi_private.can_view_academic_record(student_id));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_student_holds_updated_at'
      and tgrelid = 'public.student_holds'::regclass
  ) then
    create trigger set_student_holds_updated_at
    before update on public.student_holds
    for each row execute function lozzi_private.set_updated_at();
  end if;
end;
$$;

create or replace function lozzi_private.resolve_share_scope(
  presented_token_hash bytea,
  requested_scope text
)
returns table (
  grant_id uuid,
  student_id uuid,
  academic_record_version_id uuid,
  approved_scope text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    share_grant.id,
    share_grant.student_id,
    share_grant.academic_record_version_id,
    requested_scope
  from public.record_share_grants share_grant
  where share_grant.token_hash = presented_token_hash
    and share_grant.status = 'active'
    and share_grant.revoked_at is null
    and share_grant.expires_at > now()
    and requested_scope = any (share_grant.scopes)
  limit 1
$$;

revoke all on function lozzi_private.resolve_share_scope(bytea, text)
from public, anon, authenticated;
grant execute on function lozzi_private.resolve_share_scope(bytea, text)
to service_role;

create or replace view public.student_dashboard_summary
with (security_invoker = true)
as
select
  student.id as student_id,
  student.user_id,
  student.institution_id,
  profile.display_name,
  profile.initials,
  institution.name as institution_name,
  program.name as program_name,
  student.academic_status,
  coalesce(audit.gpa, 0)::numeric(4, 2) as gpa,
  coalesce(audit.credits_earned, 0)::numeric(6, 2) as credits_earned,
  coalesce(audit.credits_required, program_version.required_credits)::numeric(6, 2) as credits_required,
  coalesce(audit.progress_percent, 0)::numeric(5, 2) as progress_percent,
  (
    select count(*)::integer
    from public.student_holds hold
    where hold.student_id = student.id
      and hold.status = 'active'
      and hold.is_blocking
  ) as active_hold_count,
  (
    select count(*)::integer
    from public.advisor_notes note
    where note.student_id = student.id
      and note.status = 'active'
  ) as private_advisor_note_count,
  (
    select count(*)::integer
    from public.record_share_grants share_grant
    where share_grant.student_id = student.id
      and share_grant.status = 'active'
      and share_grant.expires_at > now()
  ) as active_share_count
from public.students student
join public.profiles profile on profile.id = student.user_id
join public.institutions institution on institution.id = student.institution_id
join public.student_programs student_program
  on student_program.student_id = student.id
  and student_program.status = 'active'
join public.program_versions program_version
  on program_version.id = student_program.program_version_id
join public.programs program on program.id = program_version.program_id
left join lateral (
  select snapshot.gpa, snapshot.credits_earned, snapshot.credits_required, snapshot.progress_percent
  from public.degree_audit_snapshots snapshot
  where snapshot.student_id = student.id
  order by snapshot.calculated_at desc
  limit 1
) audit on true;

revoke all on public.student_dashboard_summary from public, anon, authenticated, service_role;
grant select on public.student_dashboard_summary to authenticated, service_role;
