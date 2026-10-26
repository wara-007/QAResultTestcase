-- Microsoft mailbox grants are separate from Gmail and Drive/Sheets credentials.
create table if not exists public.microsoft_mail_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_ciphertext text not null,
  updated_at timestamptz not null default now()
);
alter table public.microsoft_mail_connections enable row level security;
revoke all on table public.microsoft_mail_connections from public, anon;
grant select, insert, update, delete on table public.microsoft_mail_connections to authenticated;
drop policy if exists "Own Microsoft mail connection" on public.microsoft_mail_connections;
create policy "Own Microsoft mail connection" on public.microsoft_mail_connections
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
