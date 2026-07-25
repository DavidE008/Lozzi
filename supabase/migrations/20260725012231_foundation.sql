create extension if not exists pgcrypto with schema extensions;

create schema if not exists lozzi_private;
revoke all on schema lozzi_private from public, anon, authenticated;
grant usage on schema lozzi_private to service_role;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;

create function lozzi_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function lozzi_private.set_updated_at() from public, anon, authenticated;
grant execute on function lozzi_private.set_updated_at() to service_role;

comment on schema lozzi_private is
  'Unexposed authorization and maintenance helpers. Never add this schema to the Data API.';
