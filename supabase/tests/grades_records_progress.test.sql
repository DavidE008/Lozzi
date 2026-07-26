begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(50);

select has_view(
  'public',
  'instructor_assigned_sections',
  'instructor assigned sections view exists'
);

select has_view(
  'public',
  'instructor_section_gradebook',
  'instructor gradebook view exists'
);

select has_view(
  'public',
  'registrar_grade_queue',
  'registrar grade queue view exists'
);

select has_view(
  'public',
  'student_academic_record',
  'student academic record view exists'
);

select has_view(
  'public',
  'student_degree_progress',
  'student degree progress view exists'
);

select is(
  (
    select count(*)::bigint
    from pg_class
    where oid in (
      'public.instructor_assigned_sections'::regclass,
      'public.instructor_section_gradebook'::regclass,
      'public.registrar_grade_queue'::regclass,
      'public.student_academic_record'::regclass,
      'public.student_degree_progress'::regclass
    )
      and 'security_invoker=true' = any (reloptions)
  ),
  5::bigint,
  'every Milestone 4 view uses security invoker'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000202';

select is(
  (select count(*)::bigint from public.instructor_assigned_sections),
  4::bigint,
  'Elena sees only her four assigned synthetic sections'
);

select is(
  (
    select count(*)::bigint
    from public.instructor_section_gradebook
    where section_id = '60000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'Elena sees Aisha in the assigned Data Structures roster'
);

select is(
  (
    select row_status
    from public.instructor_section_gradebook
    where enrollment_id = '70000000-0000-4000-8000-000000000001'
  ),
  'complete',
  'the seeded complete draft is identified deterministically'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000203';

select is(
  (
    select count(*)::bigint
    from public.instructor_section_gradebook
    where section_id = '60000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'an unrelated instructor cannot read Elena''s roster'
);

select throws_ok(
  $$
    select public.save_grade_drafts(
      '60000000-0000-4000-8000-000000000001',
      '[{"enrollmentId":"70000000-0000-4000-8000-000000000001","participationScore":10,"assignmentAverage":90,"finalExamScore":92}]',
      '91000000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  'Assigned instructor access required',
  'an unrelated instructor cannot save grades'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000202';

select ok(
  (
    public.save_grade_drafts(
      '60000000-0000-4000-8000-000000000001',
      '[{"enrollmentId":"70000000-0000-4000-8000-000000000001","participationScore":10,"assignmentAverage":90,"finalExamScore":92}]',
      '91000000-0000-4000-8000-000000000002'
    ) ->> 'success'
  )::boolean,
  'the assigned instructor saves a complete grade draft'
);

select ok(
  (
    public.save_grade_drafts(
      '60000000-0000-4000-8000-000000000001',
      '[{"enrollmentId":"70000000-0000-4000-8000-000000000001","participationScore":10,"assignmentAverage":90,"finalExamScore":92}]',
      '91000000-0000-4000-8000-000000000002'
    ) ->> 'idempotentReplay'
  )::boolean,
  'saving the same draft request is idempotent'
);

select ok(
  (
    public.submit_section_grades(
      '60000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000003'
    ) ->> 'success'
  )::boolean,
  'the assigned instructor submits the complete roster'
);

select is(
  (
    select state
    from public.grade_submissions
    where id = '71000000-0000-4000-8000-000000000201'
  ),
  'submitted',
  'the grade enters the submitted lifecycle state'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000101';

select is(
  (select count(*)::bigint from public.grade_submissions),
  0::bigint,
  'a student cannot read draft or submitted grade rows'
);

select is(
  (
    select count(*)::bigint
    from public.student_academic_record
    where student_id = '13000000-0000-4000-8000-000000000101'
  ),
  1::bigint,
  'a student sees only the previously published academic record'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000201';

select is(
  (
    select count(*)::bigint
    from public.registrar_grade_queue
    where grade_submission_id = '71000000-0000-4000-8000-000000000201'
      and state = 'submitted'
  ),
  1::bigint,
  'the registrar sees the submitted grade in the scoped queue'
);

select ok(
  (
    public.approve_grade_submission(
      '71000000-0000-4000-8000-000000000201',
      '91000000-0000-4000-8000-000000000004'
    ) ->> 'success'
  )::boolean,
  'the registrar approves a submitted grade'
);

select ok(
  (
    public.publish_grade_submission_with_anchor(
      '71000000-0000-4000-8000-000000000201',
      decode(repeat('cd', 32), 'hex'),
      'synthetic:m4:first-publication',
      '91000000-0000-4000-8000-000000000005',
      'test',
      decode(repeat('a1', 32), 'hex'),
      1,
      decode(repeat('b1', 32), 'hex'),
      1,
      '92000000-0000-4000-8000-000000000001',
      '92000000-0000-4000-8000-000000000002'
    ) ->> 'success'
  )::boolean,
  'the registrar publishes an approved grade'
);

select ok(
  (
    public.publish_grade_submission_with_anchor(
      '71000000-0000-4000-8000-000000000201',
      decode(repeat('cd', 32), 'hex'),
      'synthetic:m4:first-publication',
      '91000000-0000-4000-8000-000000000005',
      'test',
      decode(repeat('a1', 32), 'hex'),
      1,
      decode(repeat('b1', 32), 'hex'),
      1,
      '92000000-0000-4000-8000-000000000001',
      '92000000-0000-4000-8000-000000000002'
    ) ->> 'idempotentReplay'
  )::boolean,
  'publishing the same request is idempotent'
);

select is(
  (
    select version_number
    from public.grade_records
    where enrollment_id = '70000000-0000-4000-8000-000000000001'
      and is_current
  ),
  1,
  'first publication creates grade record version 1'
);

select is(
  (
    select version_number
    from public.academic_record_versions
    where student_id = '13000000-0000-4000-8000-000000000101'
      and is_current
  ),
  2,
  'first publication creates academic record version 2'
);

select is(
  (
    select credits_earned
    from public.student_degree_progress
    where student_id = '13000000-0000-4000-8000-000000000101'
  ),
  6.00::numeric,
  'degree audit credits include both current passing records'
);

select is(
  (
    select gpa
    from public.student_degree_progress
    where student_id = '13000000-0000-4000-8000-000000000101'
  ),
  3.85::numeric,
  'GPA uses deterministic credit-weighted grade points'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000202';

select ok(
  (
    public.start_grade_correction(
      (
        select id
        from public.grade_records
        where enrollment_id = '70000000-0000-4000-8000-000000000001'
          and is_current
      ),
      'calculation_error',
      '91000000-0000-4000-8000-000000000006'
    ) ->> 'success'
  )::boolean,
  'the assigned instructor starts a linked correction draft'
);

select ok(
  (
    public.save_grade_drafts(
      '60000000-0000-4000-8000-000000000001',
      '[{"enrollmentId":"70000000-0000-4000-8000-000000000001","participationScore":10,"assignmentAverage":95,"finalExamScore":94}]',
      '91000000-0000-4000-8000-000000000007'
    ) ->> 'success'
  )::boolean,
  'the instructor saves corrected component scores'
);

select ok(
  (
    public.submit_section_grades(
      '60000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000008'
    ) ->> 'success'
  )::boolean,
  'the instructor submits the corrected grade'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000201';

select ok(
  (
    public.approve_grade_submission(
      (
        select id
        from public.grade_submissions
        where enrollment_id = '70000000-0000-4000-8000-000000000001'
          and state = 'submitted'
      ),
      '91000000-0000-4000-8000-000000000009'
    ) ->> 'success'
  )::boolean,
  'the registrar approves the correction'
);

select ok(
  (
    public.publish_grade_submission_with_anchor(
      (
        select id
        from public.grade_submissions
        where enrollment_id = '70000000-0000-4000-8000-000000000001'
          and state = 'approved'
      ),
      decode(repeat('ef', 32), 'hex'),
      'synthetic:m4:corrected-publication',
      '91000000-0000-4000-8000-000000000010',
      'test',
      decode(repeat('a1', 32), 'hex'),
      1,
      decode(repeat('b1', 32), 'hex'),
      1,
      '92000000-0000-4000-8000-000000000003',
      '92000000-0000-4000-8000-000000000004'
    ) ->> 'success'
  )::boolean,
  'publishing a correction creates a new official version'
);

select is(
  (
    select count(*)::bigint
    from public.grade_records
    where enrollment_id = '70000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'both grade record versions remain stored'
);

select ok(
  exists (
    select 1
    from public.grade_records
    where enrollment_id = '70000000-0000-4000-8000-000000000001'
      and version_number = 1
      and not is_current
      and superseded_at is not null
  ),
  'grade record version 1 remains auditable and superseded'
);

select ok(
  exists (
    select 1
    from public.grade_records current_record
    join public.grade_records previous_record
      on previous_record.id = current_record.previous_grade_record_id
    where current_record.enrollment_id = '70000000-0000-4000-8000-000000000001'
      and current_record.version_number = 2
      and current_record.is_current
      and previous_record.version_number = 1
  ),
  'grade record version 2 points to version 1 and is current'
);

select is(
  (
    select version_number
    from public.academic_record_versions
    where student_id = '13000000-0000-4000-8000-000000000101'
      and is_current
  ),
  3,
  'correction creates academic record version 3'
);

select is(
  (
    select gpa
    from public.student_degree_progress
    where student_id = '13000000-0000-4000-8000-000000000101'
  ),
  4.00::numeric,
  'the latest correction deterministically recalculates GPA'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000101';

select is(
  (
    select count(*)::bigint
    from public.student_academic_record
    where student_id = '13000000-0000-4000-8000-000000000101'
  ),
  3::bigint,
  'the student record exposes the current and historical published versions'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000203';

select throws_ok(
  $$
    select public.start_grade_correction(
      (
        select id
        from public.grade_records
        where enrollment_id = '70000000-0000-4000-8000-000000000001'
          and is_current
      ),
      'clerical_error',
      '91000000-0000-4000-8000-000000000011'
    )
  $$,
  '22023',
  'Current grade record not found',
  'an unrelated instructor cannot discover or start a correction'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000201';

select ok(
  not has_function_privilege(
    'anon',
    'public.save_grade_drafts(uuid,jsonb,uuid)',
    'execute'
  ),
  'anonymous users cannot execute grade mutations'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.save_grade_drafts(uuid,jsonb,uuid)',
    'execute'
  ),
  'authenticated users receive only the guarded grade RPC boundary'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.grade_submissions',
    'update'
  ),
  'authenticated users cannot update grade tables directly'
);

select ok(
  not exists (
    select 1
    from public.audit_events
    where action like 'grade.%'
      and metadata ?| array['grade', 'gpa', 'student_number', 'email', 'name']
  ),
  'grade workflow audit metadata remains PII-free'
);

select is(
  (
    select count(*)::bigint
    from public.grade_records
    where enrollment_id = '70000000-0000-4000-8000-000000000001'
      and is_current
  ),
  1::bigint,
  'exactly one grade record version is current'
);

select is(
  (
    select count(*)::bigint
    from public.academic_record_versions
    where student_id = '13000000-0000-4000-8000-000000000101'
      and is_current
  ),
  1::bigint,
  'exactly one academic record version is current'
);

select ok(
  exists (
    select 1
    from public.academic_record_versions current_version
    join public.academic_record_versions previous_version
      on previous_version.id = current_version.previous_version_id
    where current_version.student_id = '13000000-0000-4000-8000-000000000101'
      and current_version.version_number = 3
      and previous_version.version_number = 2
      and previous_version.status = 'superseded'
  ),
  'the corrected academic record preserves its previous version link'
);

select ok(
  (
    select requirement_results
    from public.student_degree_progress
    where student_id = '13000000-0000-4000-8000-000000000101'
  ) @> '[{"code":"CS 2305","status":"complete"}]'::jsonb,
  'degree audit requirements mark the corrected course complete'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000201';

select is(
  (
    select count(*)::bigint
    from public.student_academic_record
    where student_id = '13000000-0000-4000-8000-000000000101'
      and is_current
  ),
  2::bigint,
  'the registrar sees both current course outcomes'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000202';

select throws_ok(
  $$
    select public.approve_grade_submission(
      '71000000-0000-4000-8000-000000000102',
      '91000000-0000-4000-8000-000000000012'
    )
  $$,
  '42501',
  'Registrar access required',
  'an instructor cannot approve grades'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000201';

select is(
  (
    select anchor_status
    from public.academic_record_versions
    where student_id = '13000000-0000-4000-8000-000000000101'
      and is_current
  ),
  'not_configured',
  'published records honestly report that onchain anchoring is not configured'
);

select is(
  (
    select count(*)::bigint
    from public.degree_audit_snapshots
    where student_id = '13000000-0000-4000-8000-000000000101'
      and academic_record_version_id = (
        select id
        from public.academic_record_versions
        where student_id = '13000000-0000-4000-8000-000000000101'
          and is_current
      )
  ),
  1::bigint,
  'each academic record version has one deterministic degree-audit snapshot'
);

select is(
  (
    select progress_percent
    from public.student_degree_progress
    where student_id = '13000000-0000-4000-8000-000000000101'
  ),
  5.00::numeric,
  'degree progress reflects 6 of 120 required credits'
);

select * from finish();

rollback;
