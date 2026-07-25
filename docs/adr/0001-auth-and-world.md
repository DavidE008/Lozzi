# ADR 0001: Supabase Auth and World are separate signals

Status: Accepted

Supabase Auth owns login, session cookies, email verification, and recovery.
World is an optional verification signal stored separately and never grants a
database role by itself. This preserves conventional recovery, minimizes
wallet coercion, and lets the core SIS operate when World is unavailable.
