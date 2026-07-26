begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(19);

select has_column(
  'public',
  'record_share_grants',
  'chain_status',
  'share grants distinguish private local state from onchain state'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_minimum_scope_share_draft(uuid,uuid,text,text[],integer,uuid)',
    'execute'
  ),
  'authenticated students can create their own minimum-scope draft'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.create_minimum_scope_share_draft(uuid,uuid,text,text[],integer,uuid)',
    'execute'
  ),
  'the service role cannot impersonate a student to create a draft'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000101';

select throws_ok(
  $test$
    select public.create_minimum_scope_share_draft(
      '13000000-0000-4000-8000-000000000101',
      '73000000-0000-4000-8000-000000000001',
      'Synthetic empty scope verifier',
      array[]::text[],
      15,
      '94000000-0000-4000-8000-000000000001'
    )
  $test$,
  '22023',
  'Invalid sensitive share draft',
  'an empty disclosure selection is rejected'
);
select throws_ok(
  $test$
    select public.create_minimum_scope_share_draft(
      '13000000-0000-4000-8000-000000000101',
      '73000000-0000-4000-8000-000000000001',
      'Synthetic duplicate scope verifier',
      array['program', 'program'],
      15,
      '94000000-0000-4000-8000-000000000002'
    )
  $test$,
  '22023',
  'Invalid sensitive share draft',
  'duplicate disclosure scopes are rejected'
);
select throws_ok(
  $test$
    select public.create_minimum_scope_share_draft(
      '13000000-0000-4000-8000-000000000101',
      '73000000-0000-4000-8000-000000000001',
      'Synthetic unknown scope verifier',
      array['private-transcript'],
      15,
      '94000000-0000-4000-8000-000000000003'
    )
  $test$,
  '22023',
  'Invalid sensitive share draft',
  'unknown disclosure scopes are rejected'
);
select throws_ok(
  $test$
    select public.create_minimum_scope_share_draft(
      '13000000-0000-4000-8000-000000000101',
      '73000000-0000-4000-8000-000000000001',
      'Synthetic long-lived verifier',
      array['record-summary'],
      31,
      '94000000-0000-4000-8000-000000000004'
    )
  $test$,
  '22023',
  'Invalid sensitive share draft',
  'a grant longer than thirty minutes is rejected'
);
select throws_ok(
  $test$
    select public.create_minimum_scope_share_draft(
      '13000000-0000-4000-8000-000000000102',
      (
        select id
        from public.academic_record_versions
        where student_id = '13000000-0000-4000-8000-000000000102'
          and is_current
        limit 1
      ),
      'Synthetic cross-student verifier',
      array['program'],
      15,
      '94000000-0000-4000-8000-000000000005'
    )
  $test$,
  '42501',
  'Authorized student not found',
  'a student cannot create a share for another student'
);
select lives_ok(
  $test$
    select public.create_minimum_scope_share_draft(
      '13000000-0000-4000-8000-000000000101',
      '73000000-0000-4000-8000-000000000001',
      'Synthetic minimum-scope verifier',
      array['record-summary'],
      15,
      '94000000-0000-4000-8000-000000000101'
    )
  $test$,
  'the student can create a short-lived one-scope draft'
);

reset role;

select is(
  (
    select scopes
    from public.record_share_drafts
    where idempotency_key = '94000000-0000-4000-8000-000000000101'
  ),
  array['record-summary']::text[],
  'the database stores exactly the selected scope'
);
select ok(
  (
    select grant_expires_at <= created_at + interval '30 minutes'
    from public.record_share_drafts
    where idempotency_key = '94000000-0000-4000-8000-000000000101'
  ),
  'the persisted grant expiry remains within the short-lived boundary'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000101';

select lives_ok(
  $test$
    select public.create_minimum_scope_share_draft(
      '13000000-0000-4000-8000-000000000101',
      '73000000-0000-4000-8000-000000000001',
      'Synthetic minimum-scope verifier',
      array['record-summary'],
      15,
      '94000000-0000-4000-8000-000000000101'
    )
  $test$,
  'an exact draft replay is idempotent'
);
select throws_ok(
  $test$
    select public.create_minimum_scope_share_draft(
      '13000000-0000-4000-8000-000000000101',
      '73000000-0000-4000-8000-000000000001',
      'Changed replay recipient',
      array['record-summary'],
      15,
      '94000000-0000-4000-8000-000000000101'
    )
  $test$,
  '23505',
  'Conflicting sensitive share draft replay',
  'an idempotency-key replay cannot change the disclosure'
);

reset role;

select throws_ok(
  $test$
    update public.record_share_drafts
    set scopes = array['record-summary', 'record-summary']
    where idempotency_key = '94000000-0000-4000-8000-000000000101'
  $test$,
  '23514',
  null,
  'the table constraint rejects duplicate scopes outside the RPC'
);

update public.record_share_drafts
set
  status = 'ready',
  adult_attested_at = now(),
  liveness_verified_at = now()
where idempotency_key = '94000000-0000-4000-8000-000000000101';

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000101';

select is(
  (
    public.activate_sensitive_share_with_outbox(
      (
        select id
        from public.record_share_drafts
        where idempotency_key = '94000000-0000-4000-8000-000000000101'
      ),
      decode(repeat('e1', 32), 'hex'),
      decode(repeat('e2', 32), 'hex'),
      'test',
      decode(repeat('a1', 32), 'hex'),
      1,
      decode(repeat('b1', 32), 'hex'),
      1,
      '94000000-0000-4000-8000-000000000102',
      '94000000-0000-4000-8000-000000000103'
    ) ->> 'status'
  ),
  'active',
  'the minimum-scope grant activates after the existing consent gates'
);

reset role;

select results_eq(
  $test$
    select scopes, chain_status
    from public.record_share_grants
    where token_hash = decode(repeat('e1', 32), 'hex')
  $test$,
  $values$
    values (array['record-summary']::text[], 'local_private'::text)
  $values$,
  'activation preserves exact scopes and reports private local status'
);
select is(
  (
    select count(*)::bigint
    from lozzi_private.resolve_share_scope(
      decode(repeat('e1', 32), 'hex'),
      'record-summary'
    )
  ),
  1::bigint,
  'the selected scope resolves'
);
select is(
  (
    select count(*)::bigint
    from lozzi_private.resolve_share_scope(
      decode(repeat('e1', 32), 'hex'),
      'full-record'
    )
  ),
  0::bigint,
  'an unselected scope fails closed'
);
select ok(
  not exists (
    select 1
    from public.audit_events audit
    where audit.entity_id = (
      select id
      from public.record_share_grants
      where token_hash = decode(repeat('e1', 32), 'hex')
    )
      and audit.metadata::text ~* '(token|e1e1e1)'
  ),
  'share audit metadata contains no bearer token material'
);

select * from finish();

rollback;
