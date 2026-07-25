# Normalized data model

All domain rows use UUID primary keys, `institution_id` scoping, `created_at`,
`updated_at`, and `deactivated_at` where lifecycle removal is needed.

## Identity and institutions

`profiles`, `institutions`, `institution_memberships`,
`student_profiles`, `staff_profiles`, and `staff_assignments`.

Membership role and assignment rows are authoritative. User-editable auth
metadata is display context only and never grants access.

## Academic structure

`academic_terms`, `programs`, `courses`, `course_prerequisites`,
`course_sections`, and `section_instructors`.

## Records and versioning

`enrollments`, `academic_records`, `academic_record_versions`,
`degree_requirements`, `student_degree_progress`, and `student_holds`.

Every record version points to the prior version when present. The current
record points to exactly one current version; corrections append instead of
overwriting history.

## Sharing and integrations

`share_grants`, `share_grant_scopes`, `integration_capabilities`,
`private_objects`, and `onchain_commitments`.

Share tokens are stored as one-way hashes. Public handlers later resolve only
unexpired, unrevoked grants and return allowlisted fields.

## Audit and outbox

`audit_events`, `idempotency_keys`, and `outbox_events`. Audit payloads contain
stable identifiers and action metadata, not raw student records. Outbox rows
move through constrained pending/processing/completed/failed states and retain
retry evidence.
