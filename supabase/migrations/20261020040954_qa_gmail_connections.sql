-- Separate from Drive/Sheets: connecting a mailbox cannot replace evidence credentials.
create table if not exists public.google_mail_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_ciphertext text not null,
  updated_at timestamptz not null default now()
);
alter table public.google_mail_connections enable row level security;
revoke all on table public.google_mail_connections from public, anon;
grant select, insert, update, delete on table public.google_mail_connections to authenticated;
drop policy if exists "Own Gmail connection" on public.google_mail_connections;
create policy "Own Gmail connection" on public.google_mail_connections
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
