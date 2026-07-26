begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(37);

select has_column(
  'public',
  'outbox_events',
  'schema_version',
  'outbox events store an explicit schema version'
);
select has_column(
  'public',
  'outbox_events',
  'trace_id',
  'outbox events store a trace identifier'
);
select has_column(
  'public',
  'outbox_events',
  'correlation_id',
  'outbox events store a correlation identifier'
);
select has_column(
  'public',
  'academic_record_versions',
  'institution_commitment',
  'academic versions retain their opaque institution commitment'
);
select has_column(
  'public',
  'record_share_grants',
  'student_commitment',
  'share grants retain their institution-scoped student commitment'
);
select ok(
  to_regprocedure(
    'public.publish_grade_submission_with_anchor(uuid,bytea,text,uuid,text,bytea,integer,bytea,integer,uuid,uuid)'
  ) is not null,
  'anchored publication has a typed transaction boundary'
);
select ok(
  to_regprocedure(
    'public.activate_sensitive_share_with_outbox(uuid,bytea,bytea,text,bytea,integer,bytea,integer,uuid,uuid)'
  ) is not null,
  'share activation has a typed transaction boundary'
);
select ok(
  to_regprocedure(
    'public.revoke_sensitive_share_with_outbox(uuid,uuid,uuid,uuid)'
  ) is not null,
  'share revocation has a typed transaction boundary'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.publish_grade_submission(uuid,bytea,text,uuid)',
    'execute'
  ),
  'the non-enqueueing publication implementation is not directly callable'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.activate_sensitive_share(uuid,uuid,bytea,bytea)',
    'execute'
  ),
  'the service role cannot bypass authenticated share activation'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'outbox_events_logical_event_idx'
      and indexdef like '%UNIQUE%'
  ),
  'a unique logical-event index serializes duplicate producer attempts'
);

create function lozzi_private.reject_m6_test_outbox()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'synthetic outbox failure';
end;
$$;

create trigger reject_m6_test_outbox
before insert on public.outbox_events
for each row execute function lozzi_private.reject_m6_test_outbox();

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000202';

select lives_ok(
  $test$
    select public.save_grade_drafts(
      '60000000-0000-4000-8000-000000000001',
      '[{"enrollmentId":"70000000-0000-4000-8000-000000000001","participationScore":10,"assignmentAverage":90,"finalExamScore":92}]',
      '93000000-0000-4000-8000-000000000001'
    )
  $test$,
  'the assigned instructor prepares the publication fixture'
);
select lives_ok(
  $test$
    select public.submit_section_grades(
      '60000000-0000-4000-8000-000000000001',
      '93000000-0000-4000-8000-000000000002'
    )
  $test$,
  'the assigned instructor submits the publication fixture'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000201';

select lives_ok(
  $test$
    select public.approve_grade_submission(
      '71000000-0000-4000-8000-000000000201',
      '93000000-0000-4000-8000-000000000003'
    )
  $test$,
  'the registrar approves the publication fixture'
);
select throws_ok(
  $test$
    select public.publish_grade_submission_with_anchor(
      '71000000-0000-4000-8000-000000000201',
      decode(repeat('c1', 32), 'hex'),
      'synthetic:m6:atomic-rollback',
      '93000000-0000-4000-8000-000000000004',
      'test',
      decode(repeat('a1', 32), 'hex'),
      1,
      decode(repeat('b1', 32), 'hex'),
      1,
      '93000000-0000-4000-8000-000000000005',
      '93000000-0000-4000-8000-000000000006'
    )
  $test$,
  'P0001',
  'synthetic outbox failure',
  'publication rolls back when atomic outbox insertion fails'
);
select is(
  (
    select state
    from public.grade_submissions
    where id = '71000000-0000-4000-8000-000000000201'
  ),
  'approved',
  'failed enqueue leaves the approved submission unpublished'
);
select is(
  (
    select count(*)::bigint
    from public.academic_record_versions
    where student_id = '13000000-0000-4000-8000-000000000101'
  ),
  1::bigint,
  'failed enqueue leaves append-only academic history unchanged'
);

reset role;
drop trigger reject_m6_test_outbox on public.outbox_events;
drop function lozzi_private.reject_m6_test_outbox();

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000201';

select ok(
  (
    public.publish_grade_submission_with_anchor(
      '71000000-0000-4000-8000-000000000201',
      decode(repeat('c1', 32), 'hex'),
      'synthetic:m6:atomic-rollback',
      '93000000-0000-4000-8000-000000000004',
      'test',
      decode(repeat('a1', 32), 'hex'),
      1,
      decode(repeat('b1', 32), 'hex'),
      1,
      '93000000-0000-4000-8000-000000000005',
      '93000000-0000-4000-8000-000000000006'
    ) ->> 'success'
  )::boolean,
  'publication and enqueue succeed atomically after recovery'
);

reset role;

select is(
  (
    select count(*)::bigint
    from public.outbox_events
    where event_type = 'academic_record.anchor.requested.v1'
      and aggregate_id = (
        select id
        from public.academic_record_versions
        where student_id = '13000000-0000-4000-8000-000000000101'
          and is_current
      )
  ),
  1::bigint,
  'one immutable academic version produces one anchor event'
);
select ok(
  exists (
    select 1
    from public.outbox_events event
    where event.event_type = 'academic_record.anchor.requested.v1'
      and event.schema_version = 1
      and event.payload ->> 'recordCommitment' =
        '0x' || repeat('c1', 32)
      and event.payload ->> 'institutionCommitment' =
        '0x' || repeat('a1', 32)
      and event.payload ->> 'studentCommitment' =
        '0x' || repeat('b1', 32)
  ),
  'anchor payload contains commitments and version metadata only'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000201';

select ok(
  (
    public.publish_grade_submission_with_anchor(
      '71000000-0000-4000-8000-000000000201',
      decode(repeat('c1', 32), 'hex'),
      'synthetic:m6:atomic-rollback',
      '93000000-0000-4000-8000-000000000004',
      'test',
      decode(repeat('a1', 32), 'hex'),
      1,
      decode(repeat('b1', 32), 'hex'),
      1,
      '93000000-0000-4000-8000-000000000007',
      '93000000-0000-4000-8000-000000000008'
    ) ->> 'idempotentReplay'
  )::boolean,
  'publication replay returns the existing official version'
);

reset role;

select is(
  (
    select count(*)::bigint
    from public.outbox_events
    where event_type = 'academic_record.anchor.requested.v1'
  ),
  1::bigint,
  'publication replay does not duplicate the logical event'
);
select throws_ok(
  $test$
    insert into public.outbox_events (
      institution_id,
      aggregate_type,
      aggregate_id,
      event_type,
      payload,
      idempotency_key
    )
    values (
      '10000000-0000-4000-8000-000000000001',
      'academic_record_version',
      '93000000-0000-4000-8000-000000000009',
      'academic_record.anchor.requested.v1',
      '{}'::jsonb,
      '93000000-0000-4000-8000-000000000010'
    )
  $test$,
  '23514',
  null,
  'malformed versioned event payloads are rejected by the database'
);

insert into public.record_share_drafts (
  id,
  institution_id,
  student_id,
  academic_record_version_id,
  recipient_label,
  scopes,
  status,
  draft_expires_at,
  grant_expires_at,
  adult_attested_at,
  liveness_verified_at,
  idempotency_key,
  created_by
)
values (
  '93000000-0000-4000-8000-000000000101',
  '10000000-0000-4000-8000-000000000001',
  '13000000-0000-4000-8000-000000000101',
  (
    select id
    from public.academic_record_versions
    where student_id = '13000000-0000-4000-8000-000000000101'
      and is_current
  ),
  'Synthetic minimum-scope verifier',
  array['record-summary'],
  'ready',
  now() + interval '20 minutes',
  now() + interval '30 minutes',
  now(),
  now(),
  '93000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000101'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000101';

select is(
  (
    public.activate_sensitive_share_with_outbox(
      '93000000-0000-4000-8000-000000000101',
      decode(repeat('d1', 32), 'hex'),
      decode(repeat('d2', 32), 'hex'),
      'test',
      decode(repeat('a1', 32), 'hex'),
      1,
      decode(repeat('b1', 32), 'hex'),
      1,
      '93000000-0000-4000-8000-000000000103',
      '93000000-0000-4000-8000-000000000104'
    ) ->> 'status'
  ),
  'active',
  'authenticated student activation creates the scoped share'
);

reset role;

select ok(
  exists (
    select 1
    from public.outbox_events event
    where event.event_type = 'share_grant.create.requested.v1'
      and event.payload -> 'scopes' = '["record-summary"]'::jsonb
      and event.payload ->> 'grantCommitment' =
        '0x' || repeat('d2', 32)
  ),
  'share creation enqueues only the explicitly selected scopes'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000101';

select ok(
  (
    public.activate_sensitive_share_with_outbox(
      '93000000-0000-4000-8000-000000000101',
      decode(repeat('d1', 32), 'hex'),
      decode(repeat('d2', 32), 'hex'),
      'test',
      decode(repeat('a1', 32), 'hex'),
      1,
      decode(repeat('b1', 32), 'hex'),
      1,
      '93000000-0000-4000-8000-000000000105',
      '93000000-0000-4000-8000-000000000106'
    ) ->> 'idempotentReplay'
  )::boolean,
  'share activation replay returns the existing grant'
);

reset role;

select is(
  (
    select count(*)::bigint
    from public.outbox_events
    where event_type = 'share_grant.create.requested.v1'
      and aggregate_id = (
        select record_share_grant_id
        from public.record_share_drafts
        where id = '93000000-0000-4000-8000-000000000101'
      )
  ),
  1::bigint,
  'share activation replay does not duplicate the logical event'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000102';

select throws_ok(
  $test$
    select public.revoke_sensitive_share_with_outbox(
      (
        select record_share_grant_id
        from public.record_share_drafts
        where id = '93000000-0000-4000-8000-000000000101'
      ),
      '93000000-0000-4000-8000-000000000107',
      '93000000-0000-4000-8000-000000000108',
      '93000000-0000-4000-8000-000000000109'
    )
  $test$,
  '42501',
  'Authorized share grant not found',
  'another student cannot revoke the share'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000101';

select is(
  (
    public.revoke_sensitive_share_with_outbox(
      (
        select record_share_grant_id
        from public.record_share_drafts
        where id = '93000000-0000-4000-8000-000000000101'
      ),
      '93000000-0000-4000-8000-000000000107',
      '93000000-0000-4000-8000-000000000108',
      '93000000-0000-4000-8000-000000000109'
    ) ->> 'status'
  ),
  'revoked',
  'the owning student revokes the share immediately'
);

reset role;

select ok(
  exists (
    select 1
    from public.record_share_grants share_grant
    where share_grant.id = (
      select record_share_grant_id
      from public.record_share_drafts
      where id = '93000000-0000-4000-8000-000000000101'
    )
      and share_grant.status = 'revoked'
      and share_grant.revoked_at is not null
  ),
  'offchain grant state is revoked before asynchronous reconciliation'
);
select is(
  (
    select count(*)::bigint
    from lozzi_private.resolve_share_scope(
      decode(repeat('d1', 32), 'hex'),
      'record-summary'
    )
  ),
  0::bigint,
  'revoked bearer access fails closed immediately'
);
select is(
  (
    select count(*)::bigint
    from public.outbox_events
    where event_type = 'share_grant.revoke.requested.v1'
  ),
  1::bigint,
  'revocation enqueues exactly one reconciliation event'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000101';

select ok(
  (
    public.revoke_sensitive_share_with_outbox(
      (
        select record_share_grant_id
        from public.record_share_drafts
        where id = '93000000-0000-4000-8000-000000000101'
      ),
      '93000000-0000-4000-8000-000000000107',
      '93000000-0000-4000-8000-000000000110',
      '93000000-0000-4000-8000-000000000111'
    ) ->> 'idempotentReplay'
  )::boolean,
  'revocation replay returns the already revoked grant'
);

reset role;

select is(
  (
    select count(*)::bigint
    from public.outbox_events
    where event_type = 'share_grant.revoke.requested.v1'
  ),
  1::bigint,
  'revocation replay does not duplicate the logical event'
);
select ok(
  not exists (
    select 1
    from public.outbox_events event
    where event.payload::text ~* '(email|name|student_number|grade|gpa|token|salt)'
  ),
  'Milestone 6 outbox payloads contain no private records, tokens, or salts'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.outbox_events',
    'select'
  ),
  'authenticated clients cannot inspect the server-only outbox'
);
select ok(
  not exists (
    select 1
    from public.audit_events audit
    where audit.action in (
      'grade.submission.publish',
      'share.sensitive.activate',
      'share.sensitive.revoke'
    )
      and audit.metadata ?| array[
        'email',
        'name',
        'student_number',
        'grade',
        'gpa',
        'token',
        'salt'
      ]
  ),
  'producer audit metadata remains free of private values and bearer material'
);

select * from finish();

rollback;
