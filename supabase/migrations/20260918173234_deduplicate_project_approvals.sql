alter table public.project_approval_requests
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_id text not null default '',
  add column if not exists email_error text not null default '';

-- Keep only the latest request for each Project and recipient before enforcing
-- uniqueness. Older links are intentionally invalidated to keep one canonical
-- Approval item in the PO inbox.
with ranked as (
  select
    id,
    row_number() over (
      partition by project_id, recipient_email
      order by requested_at desc, id desc
    ) as position
  from public.project_approval_requests
)
delete from public.project_approval_requests request
using ranked
where request.id = ranked.id
  and ranked.position > 1;

create unique index if not exists project_approval_requests_project_recipient_uidx
  on public.project_approval_requests (project_id, recipient_email);
