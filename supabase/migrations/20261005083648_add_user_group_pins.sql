create table public.user_group_pins (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  group_id text not null references public.groups(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  primary key (user_id, group_id)
);

create index user_group_pins_group_id_idx on public.user_group_pins (group_id);

alter table public.user_group_pins enable row level security;

revoke all on table public.user_group_pins from anon, authenticated;
grant select, insert, delete on table public.user_group_pins to authenticated;

create policy user_group_pins_select_own on public.user_group_pins
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    and (select public.is_app_authorized())
  );

create policy user_group_pins_insert_own on public.user_group_pins
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select public.is_app_authorized())
  );

create policy user_group_pins_delete_own on public.user_group_pins
  for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and (select public.is_app_authorized())
  );
