-- Temporary no-login mode: the project catalog is shared by anyone who can
-- access this application's Supabase publishable key. Keep RLS enabled and
-- expose only the minimum operations needed by the current UI.

alter table public.projects alter column owner_id drop not null;

grant select, insert on table public.projects to anon;

create policy projects_select_public_catalog
on public.projects
for select
to anon
using (true);

create policy projects_insert_public_catalog
on public.projects
for insert
to anon
with check (owner_id is null);
