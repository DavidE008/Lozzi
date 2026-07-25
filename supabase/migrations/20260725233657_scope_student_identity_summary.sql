create or replace view public.student_partner_summary
with (security_invoker = true)
as
select
  student.id as student_id,
  student.user_id,
  student.institution_id,
  world.status as world_status,
  world.credential_type as world_credential_type,
  world.verified_at as world_verified_at,
  ens.public_name as ens_name,
  ens.network as ens_network,
  ens.status as ens_status,
  ens.resolved_at as ens_resolved_at,
  storage.status as storage_status,
  storage.available_at as storage_available_at,
  inference.schema_validation_status as ai_validation_status,
  inference.completed_at as ai_completed_at
from public.students student
left join lateral (
  select
    verification.status,
    verification.credential_type,
    verification.verified_at
  from public.world_verifications verification
  where verification.student_id = student.id
    and verification.purpose = 'account-humanity'
  order by verification.created_at desc
  limit 1
) world on true
left join lateral (
  select
    identity.public_name,
    identity.network,
    identity.status,
    identity.resolved_at
  from public.ens_identities identity
  where identity.student_id = student.id
  order by identity.created_at desc
  limit 1
) ens on true
left join lateral (
  select
    object.status,
    object.available_at
  from public.zero_g_objects object
  where object.owner_student_id = student.id
  order by object.created_at desc
  limit 1
) storage on true
left join lateral (
  select
    inference_run.schema_validation_status,
    inference_run.completed_at
  from public.ai_inference_runs inference_run
  where inference_run.student_id = student.id
  order by inference_run.created_at desc
  limit 1
) inference on true;
