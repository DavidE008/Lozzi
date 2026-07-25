create index grade_submissions_approved_by_idx
  on public.grade_submissions (approved_by)
  where approved_by is not null;

create index grade_submissions_published_by_idx
  on public.grade_submissions (published_by)
  where published_by is not null;
