# Product scope

## Milestones 0–1 outcome

Milestones 0–1 prove that Lozzi can present one trustworthy student record from
a normalized, institution-scoped system while keeping partner and onchain
capabilities honest and optional.

## Included

- Supabase email/password authentication and recovery.
- Student dashboard plus read-only record, progress, shares, and settings.
- Normalized academic data, version history, holds, shares, audit, and outbox.
- Server-side repository adapters reading hosted PostgreSQL rows.
- Deterministic, salted, domain-separated commitments.
- Undeployed institution and academic-record registries with Foundry tests.
- Accessible navy/teal/gold production design based on the five approved
  concept screens.

## Excluded

- Contract deployment, mainnet assets, live ENS, World, 0G, WalletConnect, or
  partner success claims.
- Registrar mutations, registration submission, grade entry, production file
  encryption, or real student data.
- Analytics, tracking pixels, and browser-side service credentials.

## Success measures

The synthetic Aisha account signs in, sees a reproducible 4.00 GPA and 3 of 120
credits, navigates every visible student destination, and cannot read another
student’s rows. The contracts compile and pass authorization, linkage,
idempotency, expiration, revocation, privacy, and event tests.

## Milestone 2 extension

Milestone 2 adds institution-scoped academic-structure management and the
approved registrar workspace. Registrars can maintain departments, terms,
program versions and requirements, courses, prerequisites, sections,
instructor assignments, and meetings through validated server actions.
Institution administrators can additionally manage institution settings,
memberships, and staff-role assignments.

Course registration, grade publication, partner integrations, and onchain
shipping remain outside this milestone.
