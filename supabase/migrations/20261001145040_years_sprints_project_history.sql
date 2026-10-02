begin;

create table public.workspace_years (
  id uuid primary key default gen_random_uuid(),
  group_id text not null references public.groups(id) on delete cascade,
  year integer not null check (year between 2000 and 2200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (group_id, year), unique (id, group_id)
);
create table public.sprints (
  id uuid primary key default gen_random_uuid(),
  year_id uuid not null,
  group_id text not null,
  name text not null check (length(trim(name)) between 1 and 120),
  start_date date, end_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (year_id, group_id) references public.workspace_years(id, group_id) on delete cascade,
  check (start_date is null or end_date is null or end_date >= start_date),
  unique (year_id, name), unique (id, group_id)
);
create index sprints_group_idx on public.sprints(group_id);
alter table public.projects add column sprint_id uuid;

-- Preserve legacy projects. Their creation year is interpreted in Bangkok time.
insert into public.workspace_years (group_id, year)
select distinct group_id, extract(year from created_at at time zone 'Asia/Bangkok')::integer from public.projects;
insert into public.sprints (year_id, group_id, name)
select distinct y.id, p.group_id, coalesce(nullif(trim(p.sprint_no), ''), 'ยังไม่ระบุ Sprint')
from public.projects p join public.workspace_years y on y.group_id = p.group_id
and y.year = extract(year from p.created_at at time zone 'Asia/Bangkok')::integer;
update public.projects p set sprint_id = s.id, sprint_no = s.name
from public.sprints s join public.workspace_years y on y.id = s.year_id
where p.group_id = s.group_id and y.year = extract(year from p.created_at at time zone 'Asia/Bangkok')::integer
and s.name = coalesce(nullif(trim(p.sprint_no), ''), 'ยังไม่ระบุ Sprint');
alter table public.projects alter column sprint_id set not null;
alter table public.projects add constraint projects_sprint_group_fk
foreign key (sprint_id, group_id) references public.sprints(id, group_id) on delete restrict;
create index projects_sprint_idx on public.projects(sprint_id);

create table public.project_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text not null default '',
  before_data jsonb,
  after_data jsonb not null,
  created_at timestamptz not null default now()
);
create index project_history_project_idx on public.project_history(project_id, created_at desc);

create function private.can_plan_group(requested_group_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_app_access() and (private.can_manage_group(requested_group_id) or exists (
    select 1 from public.group_members gm where gm.group_id = requested_group_id
    and gm.user_id = (select auth.uid()) and gm.role = 'qa'
  ));
$$;
revoke all on function private.can_plan_group(text) from public, anon;
grant execute on function private.can_plan_group(text) to authenticated;
create function public.can_plan_group(requested_group_id text) returns boolean
language sql stable security invoker set search_path = '' as $$
  select private.can_plan_group(requested_group_id);
$$;
revoke all on function public.can_plan_group(text) from public, anon;
grant execute on function public.can_plan_group(text) to authenticated;

alter table public.workspace_years enable row level security;
alter table public.sprints enable row level security;
alter table public.project_history enable row level security;
revoke all on public.workspace_years, public.sprints, public.project_history from public, anon, authenticated;
grant select, insert on public.workspace_years, public.sprints to authenticated;
grant select on public.project_history to authenticated;
create policy years_read on public.workspace_years for select to authenticated using (private.can_access_group(group_id));
create policy years_create on public.workspace_years for insert to authenticated with check (private.can_plan_group(group_id) and created_by = (select auth.uid()));
create policy sprints_read on public.sprints for select to authenticated using (private.can_access_group(group_id));
create policy sprints_create on public.sprints for insert to authenticated with check (private.can_plan_group(group_id) and created_by = (select auth.uid()));
create policy history_read on public.project_history for select to authenticated using (private.can_view_project(project_id));

-- Validate even direct Data API updates. Denormalized sprint_no remains compatible with older readers.
create or replace function private.can_manage_project(requested_project_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_app_access() and exists (
    select 1 from public.projects p where p.id = requested_project_id
    and (p.owner_id = (select auth.uid()) or private.can_manage_group(p.group_id))
  );
$$;
create function private.validate_project_sprint() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare sprint_name text;
begin
  if tg_op = 'UPDATE' then
    if new.group_id is distinct from old.group_id then raise exception 'Cannot move Project to another Group'; end if;
    if (new.name, new.description, new.environment, new.sprint_id, new.sprint_no) is distinct from
       (old.name, old.description, old.environment, old.sprint_id, old.sprint_no)
       and not private.can_manage_project(old.id) then raise exception 'Permission denied'; end if;
  elsif not private.can_plan_group(new.group_id) then raise exception 'Permission denied';
  end if;
  select s.name into sprint_name from public.sprints s where s.id = new.sprint_id and s.group_id = new.group_id;
  if sprint_name is null then raise exception 'Sprint must belong to this Group'; end if;
  new.sprint_no := sprint_name;
  return new;
end;
$$;
create trigger projects_validate_sprint before insert or update on public.projects
for each row execute function private.validate_project_sprint();

-- Trigger-only privileged insertion: clients have no INSERT/UPDATE/DELETE grants on history.
create function private.record_project_history() returns trigger
language plpgsql security definer set search_path = '' as $$
declare previous jsonb; current_data jsonb; actor_email text;
begin
  select jsonb_build_object('name', new.name, 'description', new.description, 'environment', new.environment,
    'sprintId', s.id, 'sprint', s.name, 'year', y.year) into current_data
    from public.sprints s join public.workspace_years y on y.id = s.year_id where s.id = new.sprint_id;
  if tg_op = 'UPDATE' then
    select jsonb_build_object('name', old.name, 'description', old.description, 'environment', old.environment,
      'sprintId', s.id, 'sprint', s.name, 'year', y.year) into previous
      from public.sprints s join public.workspace_years y on y.id = s.year_id where s.id = old.sprint_id;
    if previous = current_data then return new; end if;
  end if;
  select email into actor_email from auth.users where id = (select auth.uid());
  insert into public.project_history(project_id, actor_id, actor_email, before_data, after_data)
  values (new.id, (select auth.uid()), coalesce(actor_email, ''), previous, current_data);
  return new;
end;
$$;
revoke all on function private.record_project_history() from public, anon, authenticated;
revoke all on function private.validate_project_sprint() from public, anon, authenticated;
create trigger projects_record_history after insert or update on public.projects
for each row execute function private.record_project_history();
insert into public.project_history(project_id, after_data)
select p.id, jsonb_build_object('name', p.name, 'description', p.description, 'environment', p.environment,
 'sprintId', s.id, 'sprint', s.name, 'year', y.year, 'migration', true)
from public.projects p join public.sprints s on s.id = p.sprint_id join public.workspace_years y on y.id = s.year_id;

create function private.sprint_approval_counts(requested_sprint_id uuid)
returns table(project_id uuid, has_pending boolean, has_approved boolean)
language sql stable security definer set search_path = '' as $$
 select p.id, coalesce(bool_or(a.status = 'pending'), false), coalesce(bool_or(a.status = 'approved'), false)
 from public.projects p left join public.project_approval_requests a on a.project_id = p.id
 where p.sprint_id = requested_sprint_id and private.has_app_access()
 group by p.id;
$$;
revoke all on function private.sprint_approval_counts(uuid) from public, anon;
grant execute on function private.sprint_approval_counts(uuid) to authenticated;
create function public.sprint_approval_counts(requested_sprint_id uuid)
returns table(project_id uuid, has_pending boolean, has_approved boolean)
language sql stable security invoker set search_path = '' as $$
 select * from private.sprint_approval_counts(requested_sprint_id);
$$;
revoke all on function public.sprint_approval_counts(uuid) from public, anon;
grant execute on function public.sprint_approval_counts(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
