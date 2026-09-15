create table public.project_approval_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  recipient_email text not null check (recipient_email = lower(recipient_email) and length(recipient_email) between 3 and 320),
  token_hash text not null unique check (length(token_hash) = 64),
  status text not null default 'pending' check (status in ('pending', 'approved', 'changes_requested', 'revoked')),
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_by_name text not null default '',
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  reviewed_at timestamptz,
  reviewer_name text not null default '',
  reviewer_comment text not null default '',
  constraint project_approval_review_fields check (
    (status = 'pending' and reviewed_at is null)
    or (status = 'revoked')
    or (status in ('approved', 'changes_requested') and reviewed_at is not null)
  )
);

create index project_approval_requests_project_requested_idx
  on public.project_approval_requests (project_id, requested_at desc);
create index project_approval_requests_pending_expiry_idx
  on public.project_approval_requests (expires_at)
  where status = 'pending';

alter table public.project_approval_requests enable row level security;

-- Review links are resolved by trusted server routes only. No browser role can
-- enumerate requests, token hashes, or mutate approval state through Data API.
revoke all on table public.project_approval_requests from anon, authenticated;
