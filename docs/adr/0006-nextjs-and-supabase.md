# ADR 0006: Next.js and Supabase application foundation

- Status: Accepted
- Date: 2026-07-25

## Context

Lozzi needs server-rendered authenticated experiences, a relational academic
model, assignment-derived authorization, and a migration path from a
hackathon foundation to an institution-operated service.

## Decision

Use Next.js 16.2.11 App Router with React Server Components as the default
rendering model. Browser components are limited to interaction boundaries.
Use `@supabase/ssr` cookie sessions and server-side repository adapters. Use a
dedicated Supabase PostgreSQL project for identity and canonical SIS state,
with RLS and explicit Data API grants as defense in depth.

The browser receives only the project URL and publishable key. It never
receives a service-role, database, object-wrapping, signer, or deployment key.
Database memberships and assignments, rather than editable auth metadata,
remain the authorization source.

## Consequences

Core SIS workflows remain usable when every optional onchain or partner
capability is unconfigured. Dynamic server rendering is accepted in exchange
for secure cookie and nonce handling. Repository interfaces isolate the
application from Supabase query details and create a seam for later workers
and partner adapters.
