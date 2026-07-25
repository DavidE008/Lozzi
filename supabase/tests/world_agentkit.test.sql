begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(46);

select has_table(
  'public',
  'record_share_drafts',
  'sensitive share drafts are persisted'
);
select has_table(
  'public',
  'world_proof_challenges',
  'one-time World challenges are persisted'
);
select has_column(
  'public',
  'world_verifications',
  'purpose',
  'World verification rows identify their closed purpose'
);
select hasnt_column(
  'public',
  'world_verifications',
  'proof',
  'World proof JSON is never persisted'
);
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('world_verifications', 'world_proof_challenges')
      and column_name in (
        'birth_date',
        'full_name',
        'nationality',
        'document_number',
        'face_data',
        'proof_data',
        'integrity_bundle',
        'attested_attributes'
      )
  ),
  'World tables contain no biometric, document, proof, or attribute values'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_world_proof_challenge(uuid,text,uuid,text,text,bytea,bytea,timestamptz)',
    'execute'
  ),
  'authenticated clients cannot mint trusted World challenges'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.consume_world_proof_challenge(uuid,uuid,numeric,bytea,text,boolean,text,text,timestamptz,text)',
    'execute'
  ),
  'only the trusted server can consume World challenges'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.world_proof_challenges',
    'insert'
  ),
  'authenticated clients cannot insert World challenges'
);

select has_table(
  'public',
  'agent_delegations',
  'scoped agent delegations are persisted'
);
select has_table(
  'public',
  'agentkit_usage',
  'AgentKit usage counters are persisted'
);
select has_table(
  'public',
  'agentkit_nonces',
  'AgentKit nonce hashes are persisted'
);
select has_table(
  'public',
  'degree_plan_proposals',
  'advisor-reviewed degree-plan proposals are persisted'
);
select has_table(
  'public',
  'degree_plan_proposal_items',
  'degree-plan course proposals use normalized items'
);
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('agent_delegations', 'agentkit_usage', 'agentkit_nonces')
      and column_name in (
        'human_id',
        'anonymous_human_id',
        'agent_address',
        'delegation_token',
        'nonce'
      )
  ),
  'AgentKit storage keeps only commitments and hashes'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.authorize_agent_delegation_scope(bytea,text,text,bytea,bytea,bytea,timestamptz)',
    'execute'
  ),
  'AgentKit authorization is server-only'
);
select ok(
  not has_table_privilege(
    'service_role',
    'public.degree_plan_proposal_items',
    'update'
  ),
  'proposal items cannot be edited after submission'
);

set local role service_role;

select ok(
  (
    public.create_world_proof_challenge(
      '13000000-0000-4000-8000-000000000101',
      'account-humanity',
      null,
      'lozzi-student-verification',
      'staging',
      decode(repeat('a1', 32), 'hex'),
      decode(repeat('b1', 32), 'hex'),
      now() + interval '5 minutes'
    )->>'challengeId'
  )::uuid is not null,
  'the trusted server creates a bounded account challenge'
);

select is(
  (
    public.consume_world_proof_challenge(
      (
        select id
        from public.world_proof_challenges
        where nonce = decode(repeat('a1', 32), 'hex')
      ),
      '13000000-0000-4000-8000-000000000101',
      900,
      decode(repeat('b1', 32), 'hex'),
      'proof_of_human',
      false,
      'not-requested',
      '4.0',
      now(),
      'world-account-aisha'
    )->>'status'
  ),
  'verified',
  'an account challenge records one verified human'
);

select lives_ok(
  $$
    select public.create_world_proof_challenge(
      '13000000-0000-4000-8000-000000000102',
      'account-humanity',
      null,
      'lozzi-student-verification',
      'staging',
      decode(repeat('a2', 32), 'hex'),
      decode(repeat('b2', 32), 'hex'),
      now() + interval '5 minutes'
    )
  $$,
  'a second student can request an independent account challenge'
);

select throws_ok(
  $$
    select public.consume_world_proof_challenge(
      (
        select id
        from public.world_proof_challenges
        where nonce = decode(repeat('a2', 32), 'hex')
      ),
      '13000000-0000-4000-8000-000000000102',
      900,
      decode(repeat('b2', 32), 'hex'),
      'proof_of_human',
      false,
      'not-requested',
      '4.0',
      now(),
      'world-account-mateo'
    )
  $$,
  '23505',
  'World verification replay detected',
  'one World human cannot verify two Lozzi student accounts'
);

insert into public.world_proof_challenges (
  institution_id,
  student_id,
  purpose,
  action_id,
  environment,
  nonce,
  expected_signal_hash,
  expires_at,
  created_at
)
values (
  '10000000-0000-4000-8000-000000000001',
  '13000000-0000-4000-8000-000000000101',
  'account-humanity',
  'lozzi-student-verification',
  'staging',
  decode(repeat('a3', 32), 'hex'),
  decode(repeat('b3', 32), 'hex'),
  now() - interval '5 minutes',
  now() - interval '10 minutes'
);

select throws_ok(
  $$
    select public.consume_world_proof_challenge(
      (
        select id
        from public.world_proof_challenges
        where nonce = decode(repeat('a3', 32), 'hex')
      ),
      '13000000-0000-4000-8000-000000000101',
      901,
      decode(repeat('b3', 32), 'hex'),
      'proof_of_human',
      false,
      'not-requested',
      '4.0',
      now(),
      'world-expired'
    )
  $$,
  '22023',
  'Invalid or expired World proof challenge',
  'expired World challenges are rejected'
);

select lives_ok(
  $test$
    do $body$
    begin
      perform public.create_sensitive_share_draft(
      '13000000-0000-4000-8000-000000000101',
      '73000000-0000-4000-8000-000000000001',
      'Synthetic scholarship verifier',
      array['program', 'record-summary'],
      now() + interval '30 minutes',
      '83000000-0000-4000-8000-000000000001'
      );
      perform public.create_sensitive_share_draft(
      '13000000-0000-4000-8000-000000000101',
      '73000000-0000-4000-8000-000000000001',
      'Synthetic transfer evaluator',
      array['program'],
      now() + interval '30 minutes',
      '83000000-0000-4000-8000-000000000002'
      );
    end
    $body$;
  $test$,
  'a student can create distinct synthetic sensitive-share drafts'
);

create temporary table world_share_test_context as
select
  (
    select id
    from public.record_share_drafts
    where idempotency_key = '83000000-0000-4000-8000-000000000001'
    limit 1
  ) as first_draft_id,
  (
    select id
    from public.record_share_drafts
    where idempotency_key = '83000000-0000-4000-8000-000000000002'
    limit 1
  ) as second_draft_id;

select lives_ok(
  $test$
    do $body$
    begin
      perform public.create_world_proof_challenge(
      '13000000-0000-4000-8000-000000000101',
      'adult-share-consent',
      (select first_draft_id from world_share_test_context),
      'lozzi-adult-share-consent',
      'staging',
      decode(repeat('c1', 32), 'hex'),
      decode(repeat('d1', 32), 'hex'),
      now() + interval '5 minutes'
      );
      perform public.consume_world_proof_challenge(
      (
        select id
        from public.world_proof_challenges
        where nonce = decode(repeat('c1', 32), 'hex')
      ),
      '13000000-0000-4000-8000-000000000101',
      1000,
      null,
      'passport',
      true,
      'not-requested',
      '4.0',
      now(),
      'world-adult-first'
      );
      perform public.create_world_proof_challenge(
      '13000000-0000-4000-8000-000000000101',
      'share-liveness',
      (select first_draft_id from world_share_test_context),
      'lozzi-sensitive-share-selfie-check',
      'sandbox',
      decode(repeat('c2', 32), 'hex'),
      decode(repeat('d2', 32), 'hex'),
      now() + interval '5 minutes'
      );
      perform public.consume_world_proof_challenge(
      (
        select id
        from public.world_proof_challenges
        where nonce = decode(repeat('c2', 32), 'hex')
      ),
      '13000000-0000-4000-8000-000000000101',
      1000,
      decode(repeat('d2', 32), 'hex'),
      'selfie',
      false,
      'not-requested',
      '3.0',
      now(),
      'world-selfie-first'
      );
    end
    $body$;
  $test$,
  'adult consent then Selfie Check makes the first draft ready'
);

select lives_ok(
  $test$
    do $body$
    begin
      perform public.create_world_proof_challenge(
      '13000000-0000-4000-8000-000000000101',
      'adult-share-consent',
      (select second_draft_id from world_share_test_context),
      'lozzi-adult-share-consent',
      'staging',
      decode(repeat('c3', 32), 'hex'),
      decode(repeat('d3', 32), 'hex'),
      now() + interval '5 minutes'
      );
      perform public.consume_world_proof_challenge(
      (
        select id
        from public.world_proof_challenges
        where nonce = decode(repeat('c3', 32), 'hex')
      ),
      '13000000-0000-4000-8000-000000000101',
      1000,
      null,
      'passport',
      true,
      'not-requested',
      '4.0',
      now(),
      'world-adult-second'
      );
      perform public.create_world_proof_challenge(
      '13000000-0000-4000-8000-000000000101',
      'share-liveness',
      (select second_draft_id from world_share_test_context),
      'lozzi-sensitive-share-selfie-check',
      'sandbox',
      decode(repeat('c4', 32), 'hex'),
      decode(repeat('d4', 32), 'hex'),
      now() + interval '5 minutes'
      );
      perform public.consume_world_proof_challenge(
      (
        select id
        from public.world_proof_challenges
        where nonce = decode(repeat('c4', 32), 'hex')
      ),
      '13000000-0000-4000-8000-000000000101',
      1000,
      decode(repeat('d4', 32), 'hex'),
      'selfie',
      false,
      'not-requested',
      '3.0',
      now(),
      'world-selfie-second'
      );
    end
    $body$;
  $test$,
  'the same human can complete step-ups for a distinct share draft'
);

select is(
  (
    select count(*)::bigint
    from public.world_verifications
    where purpose in ('adult-share-consent', 'share-liveness')
      and student_id = '13000000-0000-4000-8000-000000000101'
  ),
  4::bigint,
  'each share-purpose pair records exactly one successful step-up'
);

select is(
  (
    public.activate_sensitive_share(
      (select first_draft_id from world_share_test_context),
      '13000000-0000-4000-8000-000000000101',
      decode(repeat('e1', 32), 'hex'),
      decode(repeat('e2', 32), 'hex')
    )->>'status'
  ),
  'active',
  'both step-ups activate the existing scoped share grant transactionally'
);

select lives_ok(
  $$
    select public.create_degree_plan_delegation(
      '13000000-0000-4000-8000-000000000101',
      decode(repeat('31', 32), 'hex'),
      now() + interval '30 minutes',
      '84000000-0000-4000-8000-000000000001'
    )
  $$,
  'student creates a short-lived degree-plan delegation'
);

create temporary table agentkit_test_context as
select id as delegation_id
from public.agent_delegations
where idempotency_key = '84000000-0000-4000-8000-000000000001';

select is(
  (
    public.authorize_agent_delegation_scope(
      decode(repeat('31', 32), 'hex'),
      'degree-plan:read',
      '/api/agentkit/degree-plan/context',
      decode(repeat('41', 32), 'hex'),
      decode(repeat('42', 32), 'hex'),
      decode(repeat('43', 32), 'hex'),
      now() + interval '5 minutes'
    )->>'usageCount'
  ),
  '1',
  'AgentKit atomically consumes the read scope and first free use'
);

select ok(
  (
    public.get_agent_degree_plan_context(
      (select delegation_id from agentkit_test_context),
      '13000000-0000-4000-8000-000000000101',
      decode(repeat('41', 32), 'hex')
    )::text
  ) not similar to '%(name|email|grade|gpa|student)%'
  and (
    public.get_agent_degree_plan_context(
      (select delegation_id from agentkit_test_context),
      '13000000-0000-4000-8000-000000000101',
      decode(repeat('41', 32), 'hex')
    )::text
  ) like '%courseCode%',
  'agent context contains course flags but no identity or grade fields'
);

select is(
  (
    public.authorize_agent_delegation_scope(
      decode(repeat('31', 32), 'hex'),
      'degree-plan:propose',
      '/api/agentkit/degree-plan/proposals',
      decode(repeat('41', 32), 'hex'),
      decode(repeat('42', 32), 'hex'),
      decode(repeat('44', 32), 'hex'),
      now() + interval '5 minutes'
    )->>'scope'
  ),
  'degree-plan:propose',
  'the same bound agent consumes the proposal scope once'
);

select is(
  (
    public.submit_degree_plan_proposal(
      (select delegation_id from agentkit_test_context),
      '13000000-0000-4000-8000-000000000101',
      decode(repeat('41', 32), 'hex'),
      'Consider Calculus I next; an assigned advisor must review this proposal.',
      array['MATH 1314']::text[]
    )->>'status'
  ),
  'pending',
  'the agent can submit only a pending advisor-reviewed proposal'
);

select is(
  (
    select count(*)::bigint
    from public.enrollments
    where student_id = '13000000-0000-4000-8000-000000000101'
  ),
  2::bigint,
  'the degree-plan workflow cannot mutate official enrollments'
);

select throws_ok(
  $$
    update public.degree_plan_proposals
    set summary = 'Mutated agent content'
    where student_id = '13000000-0000-4000-8000-000000000101'
  $$,
  '22023',
  'Degree-plan proposal content is immutable',
  'proposal content is immutable after submission'
);

select throws_ok(
  $$
    select public.review_degree_plan_proposal(
      (
        select id
        from public.degree_plan_proposals
        where student_id = '13000000-0000-4000-8000-000000000101'
      ),
      'approved',
      'Unrelated reviewer attempt'
    )
  $$,
  '22023',
  'Invalid advisor decision',
  'service-role review cannot bypass an authenticated assigned advisor'
);

select lives_ok(
  $test$
    do $body$
    begin
      perform public.create_degree_plan_delegation(
      '13000000-0000-4000-8000-000000000101',
      decode(repeat('32', 32), 'hex'),
      now() + interval '30 minutes',
      '84000000-0000-4000-8000-000000000002'
      );
      perform public.authorize_agent_delegation_scope(
      decode(repeat('32', 32), 'hex'),
      'degree-plan:read',
      '/api/agentkit/degree-plan/context',
      decode(repeat('41', 32), 'hex'),
      decode(repeat('42', 32), 'hex'),
      decode(repeat('45', 32), 'hex'),
      now() + interval '5 minutes'
      );
      perform public.create_degree_plan_delegation(
      '13000000-0000-4000-8000-000000000101',
      decode(repeat('33', 32), 'hex'),
      now() + interval '30 minutes',
      '84000000-0000-4000-8000-000000000003'
      );
      perform public.authorize_agent_delegation_scope(
      decode(repeat('33', 32), 'hex'),
      'degree-plan:read',
      '/api/agentkit/degree-plan/context',
      decode(repeat('41', 32), 'hex'),
      decode(repeat('42', 32), 'hex'),
      decode(repeat('46', 32), 'hex'),
      now() + interval '5 minutes'
      );
    end
    $body$;
  $test$,
  'the anonymous human receives exactly three free read uses'
);

select lives_ok(
  $$
    select public.create_degree_plan_delegation(
      '13000000-0000-4000-8000-000000000101',
      decode(repeat('34', 32), 'hex'),
      now() + interval '30 minutes',
      '84000000-0000-4000-8000-000000000004'
    )
  $$,
  'a fourth delegation can exist before endpoint authorization'
);

select throws_ok(
  $$
    select public.authorize_agent_delegation_scope(
      decode(repeat('34', 32), 'hex'),
      'degree-plan:read',
      '/api/agentkit/degree-plan/context',
      decode(repeat('41', 32), 'hex'),
      decode(repeat('42', 32), 'hex'),
      decode(repeat('47', 32), 'hex'),
      now() + interval '5 minutes'
    )
  $$,
  'P0001',
  'AgentKit free-trial usage limit reached',
  'AgentKit usage enforcement is atomic at three uses per endpoint'
);

select throws_ok(
  $$
    select public.authorize_agent_delegation_scope(
      decode(repeat('34', 32), 'hex'),
      'degree-plan:propose',
      '/api/agentkit/degree-plan/context',
      decode(repeat('41', 32), 'hex'),
      decode(repeat('42', 32), 'hex'),
      decode(repeat('48', 32), 'hex'),
      now() + interval '5 minutes'
    )
  $$,
  '22023',
  'Invalid AgentKit authorization',
  'delegation scope is bound to the intended resource'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_advisor_degree_plan_proposals()',
    'execute'
  ),
  'authenticated advisors can execute the RLS-backed review queue'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000101';

select is(
  (
    select count(*)::bigint
    from public.degree_plan_proposals
    where student_id = '13000000-0000-4000-8000-000000000101'
  ),
  1::bigint,
  'student sees their own pending proposal'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000203';

select is(
  (select count(*)::bigint from public.degree_plan_proposals),
  0::bigint,
  'unrelated instructor cannot read degree-plan proposals'
);

select throws_ok(
  $$
    select public.review_degree_plan_proposal(
      (
        select id
        from public.degree_plan_proposals
        where student_id = '13000000-0000-4000-8000-000000000101'
      ),
      'approved',
      'Unrelated instructor decision'
    )
  $$,
  '42501',
  'Pending assigned proposal not found',
  'unrelated staff cannot review an advisor proposal'
);

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000204';

select is(
  jsonb_array_length(public.get_advisor_degree_plan_proposals()),
  1,
  'assigned advisor queue returns only the assigned student proposal'
);

select is(
  (
    select count(*)::bigint
    from public.degree_plan_proposals
    where student_id = '13000000-0000-4000-8000-000000000101'
  ),
  1::bigint,
  'assigned advisor can read their student proposal'
);

select is(
  (
    public.review_degree_plan_proposal(
      (
        select id
        from public.degree_plan_proposals
        where student_id = '13000000-0000-4000-8000-000000000101'
      ),
      'approved',
      'The synthetic Calculus I proposal is appropriate for advisor follow-up.'
    )->>'status'
  ),
  'approved',
  'assigned advisor can approve without changing official records'
);

reset role;

select ok(
  not exists (
    select 1
    from public.audit_events
    where action in (
      'world.challenge.consume',
      'share.sensitive.activate',
      'degree_plan.proposal.submit',
      'degree_plan.proposal.review'
    )
      and metadata ?| array[
        'email',
        'name',
        'student_number',
        'grade',
        'gpa',
        'nullifier',
        'signal',
        'proof',
        'humanId',
        'agentAddress'
      ]
  ),
  'new audit history remains proof-free and PII-free'
);

select * from finish();
rollback;
