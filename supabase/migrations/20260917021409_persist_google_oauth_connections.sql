create table if not exists public.google_oauth_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_ciphertext text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_oauth_connections enable row level security;

revoke all on table public.google_oauth_connections from public, anon;
grant select, insert, update, delete on table public.google_oauth_connections to authenticated;

drop policy if exists "Users can read their own Google connection" on public.google_oauth_connections;
create policy "Users can read their own Google connection"
on public.google_oauth_connections
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own Google connection" on public.google_oauth_connections;
create policy "Users can create their own Google connection"
on public.google_oauth_connections
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own Google connection" on public.google_oauth_connections;
create policy "Users can update their own Google connection"
on public.google_oauth_connections
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own Google connection" on public.google_oauth_connections;
create policy "Users can delete their own Google connection"
on public.google_oauth_connections
for delete
to authenticated
using ((select auth.uid()) = user_id);

comment on table public.google_oauth_connections is
  'Encrypted Google OAuth credentials for each authenticated application user. Tokens are encrypted by the application before storage.';

notify pgrst, 'reload schema';
