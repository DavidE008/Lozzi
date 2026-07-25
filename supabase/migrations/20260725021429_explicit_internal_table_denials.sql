-- Internal coordination tables are service-role only. These explicit
-- authenticated policies document the denial while service_role continues
-- to bypass RLS for trusted workers.
create policy idempotency_keys_deny_direct_access
on public.idempotency_keys
for all
to authenticated
using (false)
with check (false);

create policy outbox_events_deny_direct_access
on public.outbox_events
for all
to authenticated
using (false)
with check (false);
