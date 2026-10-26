begin;
create schema if not exists private;
create table private.source_storage_cleanup_lease (
 singleton boolean primary key default true check(singleton), token uuid not null, expires_at timestamptz not null
);
alter table private.source_storage_cleanup_lease enable row level security;
revoke all on private.source_storage_cleanup_lease from public,anon,authenticated;
grant usage on schema private to service_role;
grant select,insert,update,delete on private.source_storage_cleanup_lease to service_role;

-- Statement guards cover empty tables too. Shared advisory transaction locks
-- let begin() wait until every already-running guarded writer commits.
create function private.guard_source_storage_cleanup() returns trigger
language plpgsql security definer set search_path='' as $$
declare lease private.source_storage_cleanup_lease;
begin
 perform pg_catalog.pg_advisory_xact_lock_shared(726310260001);
 select * into lease from private.source_storage_cleanup_lease where singleton and expires_at>pg_catalog.clock_timestamp();
 if found and coalesce(pg_catalog.current_setting('qa.source_cleanup_token',true),'')<>lease.token::text then
  raise exception 'กำลังจัดพื้นที่ไฟล์ต้นฉบับ กรุณาลองบันทึกอีกครั้งในอีกสักครู่' using errcode='55000';
 end if;
 return null;
end $$;
revoke all on function private.guard_source_storage_cleanup() from public,anon,authenticated;
do $$ declare tbl text; begin
 foreach tbl in array array['source_files','test_cases','test_executions','export_jobs','projects','project_sprint_snapshots','project_sprint_snapshot_cases','project_history','project_approval_requests'] loop
  execute format('create trigger source_storage_cleanup_guard before insert or update or delete on public.%I for each statement execute function private.guard_source_storage_cleanup()',tbl);
 end loop;
end $$;

create function public.qa_source_storage_cleanup_begin(requested_token uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare lease private.source_storage_cleanup_lease;
begin
 perform pg_catalog.pg_advisory_xact_lock(726310260001);
 select * into lease from private.source_storage_cleanup_lease where singleton for update;
 if found and lease.token=requested_token and lease.expires_at<=pg_catalog.clock_timestamp() then raise exception 'Cleanup lease expired; rebuild inventory'; end if;
 if found and lease.expires_at>pg_catalog.clock_timestamp() and lease.token<>requested_token then raise exception 'Storage cleanup already running'; end if;
 insert into private.source_storage_cleanup_lease(singleton,token,expires_at) values(true,requested_token,pg_catalog.clock_timestamp()+interval '10 minutes')
 on conflict(singleton) do update set token=excluded.token,expires_at=excluded.expires_at;
 return true;
end $$;

create function public.qa_source_storage_cleanup_end(requested_token uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 delete from private.source_storage_cleanup_lease where singleton and token=requested_token;
 return found;
end $$;

create function public.qa_source_storage_cleanup_finish(requested_token uuid,requested_source uuid,requested_key text,deleted_bytes bigint) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from private.source_storage_cleanup_lease where singleton and token=requested_token and expires_at>pg_catalog.clock_timestamp()) then raise exception 'Invalid cleanup lease'; end if;
 perform pg_catalog.set_config('qa.source_cleanup_token',requested_token::text,true);
 update public.source_files set column_mapping=coalesce(column_mapping,'{}'::jsonb)||jsonb_build_object('storageCleanup',jsonb_build_object(
  'deletedAt',pg_catalog.clock_timestamp(),'originalStorageKey',storage_key,'originalByteSize',byte_size,'deletedBytes',deleted_bytes)),storage_key='',byte_size=0
 where id=requested_source and storage_key=requested_key;
 if not found then raise exception 'Source changed during cleanup'; end if;
 return true;
end $$;
revoke all on function public.qa_source_storage_cleanup_begin(uuid),public.qa_source_storage_cleanup_end(uuid),public.qa_source_storage_cleanup_finish(uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.qa_source_storage_cleanup_begin(uuid),public.qa_source_storage_cleanup_end(uuid),public.qa_source_storage_cleanup_finish(uuid,uuid,text,bigint) to service_role;
create function public.qa_source_storage_cleanup_renew(requested_token uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(726310260001);
 update private.source_storage_cleanup_lease set expires_at=pg_catalog.clock_timestamp()+interval '10 minutes'
 where singleton and token=requested_token and expires_at>pg_catalog.clock_timestamp();
 if not found then raise exception 'Invalid cleanup lease; rebuild inventory'; end if;
 return true;
end $$;
revoke all on function public.qa_source_storage_cleanup_renew(uuid) from public,anon,authenticated;
grant execute on function public.qa_source_storage_cleanup_renew(uuid) to service_role;

commit;
