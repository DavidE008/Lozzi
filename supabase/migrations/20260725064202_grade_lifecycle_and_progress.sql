alter table public.idempotency_keys
  add column result jsonb;

alter table public.grade_submissions
  alter column grade_code drop not null,
  add column participation_score numeric(5,2),
  add column assignment_average numeric(5,2),
  add column final_exam_score numeric(5,2),
  add column total_score numeric(5,2),
  add column previous_grade_submission_id uuid
    references public.grade_submissions(id) on delete restrict,
  add column approved_by uuid references auth.users(id) on delete restrict,
  add column published_by uuid references auth.users(id) on delete restrict,
  add column draft_revision integer not null default 1,
  add column idempotency_key uuid not null default gen_random_uuid();

update public.grade_submissions
set
  participation_score = 10,
  assignment_average = case grade_code
    when 'A' then 94
    when 'B' then 84
    when 'C' then 74
    when 'D' then 64
    else 50
  end,
  final_exam_score = case grade_code
    when 'A' then 94
    when 'B' then 84
    when 'C' then 74
    when 'D' then 64
    else 50
  end,
  total_score = case grade_code
    when 'A' then 94.60
    when 'B' then 85.60
    when 'C' then 76.60
    when 'D' then 67.60
    else 55
  end,
  approved_by = case
    when state in ('approved', 'published')
      then coalesce(updated_by, created_by, submitted_by)
    else approved_by
  end,
  published_by = case
    when state = 'published'
      then coalesce(updated_by, created_by, submitted_by)
    else published_by
  end
where state in ('submitted', 'approved', 'published')
  and (
    participation_score is null
    or assignment_average is null
    or final_exam_score is null
    or total_score is null
    or (state in ('approved', 'published') and approved_by is null)
    or (state = 'published' and published_by is null)
  );

update public.grade_submissions submission
set
  state = 'published',
  published_at = record.published_at,
  published_by = record.created_by,
  updated_at = greatest(submission.updated_at, record.published_at),
  updated_by = record.created_by
from public.grade_records record
where record.grade_submission_id = submission.id
  and submission.state = 'approved';

alter table public.grade_submissions
  add constraint grade_submissions_participation_score_check
    check (participation_score between 0 and 10),
  add constraint grade_submissions_assignment_average_check
    check (assignment_average between 0 and 100),
  add constraint grade_submissions_final_exam_score_check
    check (final_exam_score between 0 and 100),
  add constraint grade_submissions_total_score_check
    check (total_score between 0 and 100),
  add constraint grade_submissions_draft_revision_check
    check (draft_revision > 0),
  add constraint grade_submissions_lifecycle_fields_check
    check (
      state = 'draft'
      or (
        participation_score is not null
        and assignment_average is not null
        and final_exam_score is not null
        and total_score is not null
        and grade_code is not null
        and grade_points is not null
        and submitted_at is not null
      )
    ),
  add constraint grade_submissions_approval_fields_check
    check (
      state not in ('approved', 'published')
      or (approved_at is not null and approved_by is not null)
    ),
  add constraint grade_submissions_publication_fields_check
    check (
      state <> 'published'
      or (published_at is not null and published_by is not null)
    ),
  add constraint grade_submissions_correction_fields_check
    check (
      previous_grade_submission_id is null
      or correction_reason_code is not null
    ),
  add constraint grade_submissions_correction_reason_check
    check (
      correction_reason_code is null
      or correction_reason_code in (
        'clerical_error',
        'calculation_error',
        'incomplete_resolved',
        'appeal_outcome',
        'other_documented'
      )
    );

create unique index grade_submissions_one_working_copy_idx
  on public.grade_submissions (enrollment_id)
  where state in ('draft', 'submitted', 'approved');

create unique index grade_submissions_idempotency_idx
  on public.grade_submissions (institution_id, idempotency_key);

create index grade_submissions_previous_idx
  on public.grade_submissions (previous_grade_submission_id)
  where previous_grade_submission_id is not null;

alter table public.grade_records
  add column correction_reason_code text,
  add column superseded_at timestamptz;

alter table public.grade_records
  add constraint grade_records_version_link_check
    check (
      (version_number = 1 and previous_grade_record_id is null)
      or (version_number > 1 and previous_grade_record_id is not null)
    ),
  add constraint grade_records_correction_reason_check
    check (
      version_number = 1
      or correction_reason_code is not null
    ),
  add constraint grade_records_current_state_check
    check (
      (is_current and superseded_at is null)
      or (not is_current and superseded_at is not null)
    );

create index grade_records_previous_idx
  on public.grade_records (previous_grade_record_id)
  where previous_grade_record_id is not null;

alter table public.academic_record_versions
  add column source_grade_record_id uuid
    references public.grade_records(id) on delete restrict,
  add column superseded_at timestamptz;

alter table public.academic_record_versions
  add constraint academic_record_versions_version_link_check
    check (
      (version_number = 1 and previous_version_id is null)
      or (version_number > 1 and previous_version_id is not null)
    ),
  add constraint academic_record_versions_current_state_check
    check (
      (is_current and superseded_at is null)
      or (not is_current and superseded_at is not null)
    );

create index academic_record_versions_source_grade_idx
  on public.academic_record_versions (source_grade_record_id)
  where source_grade_record_id is not null;

create unique index degree_audit_snapshots_record_program_idx
  on public.degree_audit_snapshots (
    academic_record_version_id,
    student_program_id
  );

drop policy if exists grade_submissions_authorized_select
  on public.grade_submissions;

create policy grade_submissions_staff_select
on public.grade_submissions for select to authenticated
using (
  lozzi_private.has_membership(
    institution_id,
    array['registrar', 'institution_admin']
  )
  or exists (
    select 1
    from public.enrollments enrollment
    where enrollment.id = grade_submissions.enrollment_id
      and lozzi_private.is_section_instructor(enrollment.section_id)
  )
);

drop policy if exists grade_records_authorized_select
  on public.grade_records;

create policy grade_records_authorized_select
on public.grade_records for select to authenticated
using (
  exists (
    select 1
    from public.enrollments enrollment
    where enrollment.id = grade_records.enrollment_id
      and (
        lozzi_private.can_view_academic_record(enrollment.student_id)
        or lozzi_private.is_section_instructor(enrollment.section_id)
      )
  )
);

revoke insert, update, delete
  on table public.grade_submissions,
    public.grade_records,
    public.academic_record_versions,
    public.degree_audit_snapshots
  from anon, authenticated;
