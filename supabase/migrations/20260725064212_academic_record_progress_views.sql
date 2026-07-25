create view public.instructor_assigned_sections
with (security_invoker = true)
as
select
  section.id as section_id,
  section.institution_id,
  institution.name as institution_name,
  term.id as term_id,
  term.name as term_name,
  course.code as course_code,
  course.title as course_title,
  section.section_code,
  section.capacity,
  coalesce(roster.roster_count, 0)::integer as roster_count,
  section.location,
  section.status as section_status,
  coalesce(meeting.schedule, 'Schedule to be announced') as schedule,
  coalesce(workflow.lifecycle_state, 'draft') as lifecycle_state,
  workflow.last_saved_at
from public.course_sections section
join public.institutions institution
  on institution.id = section.institution_id
join public.academic_terms term
  on term.id = section.term_id
join public.courses course
  on course.id = section.course_id
left join lateral (
  select count(*) as roster_count
  from public.enrollments enrollment
  where enrollment.section_id = section.id
    and enrollment.status in ('enrolled', 'completed')
) roster on true
left join lateral (
  select string_agg(
    case section_meeting.weekday
      when 1 then 'Mon'
      when 2 then 'Tue'
      when 3 then 'Wed'
      when 4 then 'Thu'
      when 5 then 'Fri'
      when 6 then 'Sat'
      when 7 then 'Sun'
    end
      || ' '
      || to_char(section_meeting.starts_at, 'HH12:MI AM')
      || '–'
      || to_char(section_meeting.ends_at, 'HH12:MI AM'),
    ' · '
    order by section_meeting.weekday, section_meeting.starts_at
  ) as schedule
  from public.section_meetings section_meeting
  where section_meeting.section_id = section.id
) meeting on true
left join lateral (
  select
    case
      when bool_or(submission.state = 'draft') then 'draft'
      when bool_or(submission.state = 'submitted') then 'submitted'
      when bool_or(submission.state = 'approved') then 'approved'
      when bool_or(submission.state = 'published') then 'published'
      else null
    end as lifecycle_state,
    max(submission.updated_at) as last_saved_at
  from public.grade_submissions submission
  join public.enrollments enrollment
    on enrollment.id = submission.enrollment_id
  where enrollment.section_id = section.id
) workflow on true
where section.deactivated_at is null
  and lozzi_private.is_section_instructor(section.id);

create view public.instructor_section_gradebook
with (security_invoker = true)
as
select
  section.id as section_id,
  section.institution_id,
  institution.name as institution_name,
  term.id as term_id,
  term.name as term_name,
  course.code as course_code,
  course.title as course_title,
  section.section_code,
  section.location,
  coalesce(meeting.schedule, 'Schedule to be announced') as schedule,
  enrollment.id as enrollment_id,
  enrollment.student_id,
  profile.display_name as student_display_name,
  profile.initials as student_initials,
  submission.id as grade_submission_id,
  submission.previous_grade_submission_id,
  coalesce(submission.state, 'draft') as lifecycle_state,
  submission.participation_score,
  submission.assignment_average,
  submission.final_exam_score,
  submission.total_score,
  submission.grade_code,
  submission.grade_points,
  submission.correction_reason_code,
  submission.draft_revision,
  submission.updated_at as last_saved_at,
  current_record.id as current_grade_record_id,
  current_record.version_number as current_grade_record_version,
  case
    when submission.id is null then 'not_started'
    when submission.state = 'draft'
      and (
        submission.participation_score is null
        or submission.assignment_average is null
        or submission.final_exam_score is null
      )
      then 'needs_attention'
    when submission.state = 'draft' then 'complete'
    else submission.state
  end as row_status
from public.enrollments enrollment
join public.course_sections section
  on section.id = enrollment.section_id
join public.institutions institution
  on institution.id = section.institution_id
join public.academic_terms term
  on term.id = section.term_id
join public.courses course
  on course.id = section.course_id
join public.students student
  on student.id = enrollment.student_id
join public.profiles profile
  on profile.id = student.user_id
left join lateral (
  select grade_submission.*
  from public.grade_submissions grade_submission
  where grade_submission.enrollment_id = enrollment.id
  order by
    case
      when grade_submission.state in ('draft', 'submitted', 'approved') then 0
      else 1
    end,
    grade_submission.created_at desc
  limit 1
) submission on true
left join lateral (
  select grade_record.*
  from public.grade_records grade_record
  where grade_record.enrollment_id = enrollment.id
    and grade_record.is_current
  limit 1
) current_record on true
left join lateral (
  select string_agg(
    case section_meeting.weekday
      when 1 then 'Mon'
      when 2 then 'Tue'
      when 3 then 'Wed'
      when 4 then 'Thu'
      when 5 then 'Fri'
      when 6 then 'Sat'
      when 7 then 'Sun'
    end
      || ' '
      || to_char(section_meeting.starts_at, 'HH12:MI AM')
      || '–'
      || to_char(section_meeting.ends_at, 'HH12:MI AM'),
    ' · '
    order by section_meeting.weekday, section_meeting.starts_at
  ) as schedule
  from public.section_meetings section_meeting
  where section_meeting.section_id = section.id
) meeting on true
where enrollment.status in ('enrolled', 'completed')
  and section.deactivated_at is null
  and student.deactivated_at is null
  and lozzi_private.is_section_instructor(section.id);

create view public.registrar_grade_queue
with (security_invoker = true)
as
select
  submission.id as grade_submission_id,
  submission.institution_id,
  enrollment.student_id,
  profile.display_name as student_display_name,
  course.code as course_code,
  course.title as course_title,
  section.id as section_id,
  section.section_code,
  term.name as term_name,
  submission.state,
  submission.grade_code,
  submission.grade_points,
  submission.total_score,
  submission.correction_reason_code,
  submission.previous_grade_submission_id,
  submission.submitted_at,
  submission.approved_at,
  submitter.display_name as submitted_by_display_name,
  current_record.id as current_grade_record_id,
  current_record.version_number as current_grade_record_version
from public.grade_submissions submission
join public.enrollments enrollment
  on enrollment.id = submission.enrollment_id
join public.students student
  on student.id = enrollment.student_id
join public.profiles profile
  on profile.id = student.user_id
join public.course_sections section
  on section.id = enrollment.section_id
join public.courses course
  on course.id = section.course_id
join public.academic_terms term
  on term.id = section.term_id
join public.profiles submitter
  on submitter.id = submission.submitted_by
left join lateral (
  select record.*
  from public.grade_records record
  where record.enrollment_id = enrollment.id
    and record.is_current
  limit 1
) current_record on true
where submission.state in ('submitted', 'approved')
  and lozzi_private.has_membership(
    submission.institution_id,
    array['registrar', 'institution_admin']
  );

create view public.student_academic_record
with (security_invoker = true)
as
select
  record.id as grade_record_id,
  record.institution_id,
  enrollment.student_id,
  course.id as course_id,
  course.code as course_code,
  course.title as course_title,
  term.name as term_name,
  enrollment.credit_hours as attempted_credit_hours,
  record.credit_hours_earned,
  record.grade_code,
  record.grade_points,
  record.version_number,
  record.previous_grade_record_id,
  record.correction_reason_code,
  record.is_current,
  record.published_at,
  record.superseded_at,
  academic_version.id as academic_record_version_id,
  academic_version.version_number as academic_record_version,
  academic_version.anchor_status
from public.grade_records record
join public.enrollments enrollment
  on enrollment.id = record.enrollment_id
join public.course_sections section
  on section.id = enrollment.section_id
join public.courses course
  on course.id = section.course_id
join public.academic_terms term
  on term.id = section.term_id
left join public.academic_record_versions academic_version
  on academic_version.source_grade_record_id = record.id;

create view public.student_degree_progress
with (security_invoker = true)
as
select
  student.id as student_id,
  student.institution_id,
  program.name as program_name,
  program_version.version_number as program_version,
  snapshot.id as degree_audit_snapshot_id,
  snapshot.academic_record_version_id,
  snapshot.credits_earned,
  snapshot.credits_required,
  snapshot.gpa,
  snapshot.progress_percent,
  snapshot.requirement_results,
  snapshot.calculated_at
from public.students student
join public.student_programs student_program
  on student_program.student_id = student.id
  and student_program.status = 'active'
join public.program_versions program_version
  on program_version.id = student_program.program_version_id
join public.programs program
  on program.id = program_version.program_id
join lateral (
  select audit.*
  from public.degree_audit_snapshots audit
  join public.academic_record_versions record_version
    on record_version.id = audit.academic_record_version_id
  where audit.student_id = student.id
    and audit.student_program_id = student_program.id
  order by record_version.version_number desc
  limit 1
) snapshot on true;

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
  coalesce(
    audit.credits_required,
    program_version.required_credits
  )::numeric(6, 2) as credits_required,
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
  select
    snapshot.gpa,
    snapshot.credits_earned,
    snapshot.credits_required,
    snapshot.progress_percent
  from public.degree_audit_snapshots snapshot
  join public.academic_record_versions record_version
    on record_version.id = snapshot.academic_record_version_id
  where snapshot.student_id = student.id
  order by record_version.version_number desc
  limit 1
) audit on true;

revoke all on public.instructor_assigned_sections
  from public, anon, authenticated, service_role;
revoke all on public.instructor_section_gradebook
  from public, anon, authenticated, service_role;
revoke all on public.registrar_grade_queue
  from public, anon, authenticated, service_role;
revoke all on public.student_academic_record
  from public, anon, authenticated, service_role;
revoke all on public.student_degree_progress
  from public, anon, authenticated, service_role;

grant select on public.instructor_assigned_sections
  to authenticated, service_role;
grant select on public.instructor_section_gradebook
  to authenticated, service_role;
grant select on public.registrar_grade_queue
  to authenticated, service_role;
grant select on public.student_academic_record
  to authenticated, service_role;
grant select on public.student_degree_progress
  to authenticated, service_role;
