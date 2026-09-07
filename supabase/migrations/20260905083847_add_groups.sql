create table public.groups (
  id text primary key default gen_random_uuid()::text,
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null default '',
  owner_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_members (
  group_id text not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'qa_lead', 'qa', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

insert into public.groups (id, name, description, owner_id)
values ('default', 'QA Team', 'กลุ่มเริ่มต้นสำหรับ Projects เดิม', null)
on conflict (id) do nothing;

alter table public.projects add column group_id text references public.groups(id) on delete restrict;
update public.projects set group_id = 'default' where group_id is null;
alter table public.projects alter column group_id set not null;
create index projects_group_id_idx on public.projects(group_id);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

create or replace function private.can_access_group(requested_group_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.groups g
    where g.id = requested_group_id
      and (
        g.owner_id is null
        or g.owner_id = (select auth.uid())
        or exists (
          select 1 from public.group_members gm
          where gm.group_id = requested_group_id
            and gm.user_id = (select auth.uid())
        )
      )
  );
$$;

create or replace function private.can_manage_group(requested_group_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.groups g
    where g.id = requested_group_id
      and (
        g.owner_id is null
        or g.owner_id = (select auth.uid())
        or exists (
          select 1 from public.group_members gm
          where gm.group_id = requested_group_id
            and gm.user_id = (select auth.uid())
            and gm.role in ('admin', 'qa_lead')
        )
      )
  );
$$;

revoke execute on function private.can_access_group(text) from public, anon;
revoke execute on function private.can_manage_group(text) from public, anon;
grant execute on function private.can_access_group(text) to authenticated;
grant execute on function private.can_manage_group(text) to authenticated;

grant select, insert, update, delete on public.groups, public.group_members to authenticated;

create policy groups_select_member on public.groups for select to authenticated
using ((select private.can_access_group(id)));
create policy groups_insert_owner on public.groups for insert to authenticated
with check (owner_id = (select auth.uid()));
create policy groups_update_manager on public.groups for update to authenticated
using ((select private.can_manage_group(id)))
with check ((select private.can_manage_group(id)));
create policy groups_delete_manager on public.groups for delete to authenticated
using ((select private.can_manage_group(id)));

create policy group_members_select_member on public.group_members for select to authenticated
using ((select private.can_access_group(group_id)));
create policy group_members_insert_manager on public.group_members for insert to authenticated
with check ((select private.can_manage_group(group_id)));
create policy group_members_update_manager on public.group_members for update to authenticated
using ((select private.can_manage_group(group_id)))
with check ((select private.can_manage_group(group_id)));
create policy group_members_delete_manager on public.group_members for delete to authenticated
using ((select private.can_manage_group(group_id)));

drop policy if exists projects_insert_owner on public.projects;
create policy projects_insert_owner on public.projects for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and (select private.can_access_group(group_id))
);
