create index registration_requests_term_fk_idx
  on public.registration_requests (term_id);

create index registration_requests_created_by_fk_idx
  on public.registration_requests (created_by);
