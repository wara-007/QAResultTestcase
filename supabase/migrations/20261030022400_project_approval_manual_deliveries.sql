-- Manual sending is an attestation by an authorized QA, never a provider receipt.
create table public.project_approval_manual_deliveries (
  id uuid primary key,
  request_id uuid not null references public.project_approval_requests(id) on delete cascade,
  prepared_at timestamptz not null,
  prepared_by uuid not null references auth.users(id) on delete restrict,
  draft jsonb not null,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete restrict,
  confirmed_by_name text not null default '',
  constraint approval_manual_draft_shape check ((
    jsonb_typeof(draft) = 'object'
    and jsonb_typeof(draft->'senderEmail') = 'string'
    and jsonb_typeof(draft->'recipientEmail') = 'string'
    and jsonb_typeof(draft->'cc') = 'array'
    and jsonb_typeof(draft->'subject') = 'string'
    and jsonb_typeof(draft->'body') = 'string'
  ) is true),
  constraint approval_manual_confirmation_shape check (
    (confirmed_at is null and confirmed_by is null and confirmed_by_name = '')
    or (confirmed_at is not null and confirmed_by is not null and length(trim(confirmed_by_name)) > 0)
  )
);
create index approval_manual_deliveries_request_idx
  on public.project_approval_manual_deliveries(request_id, prepared_at desc);
alter table public.project_approval_manual_deliveries enable row level security;
revoke all on public.project_approval_manual_deliveries from public, anon, authenticated;
grant select, insert, update on public.project_approval_manual_deliveries to service_role;
grant select, insert, update on public.project_approval_requests to service_role;

-- Reserve the current delivery and store its full draft in the same transaction.
-- Existing requests update notification metadata only; PO decisions/links survive.
create or replace function public.prepare_project_approval_manual_delivery(
  p_request jsonb, p_existing jsonb, p_delivery_id uuid, p_draft jsonb
) returns setof public.project_approval_requests
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  payload public.project_approval_requests%rowtype;
  saved public.project_approval_requests%rowtype;
begin
  select * into payload from jsonb_populate_record(null::public.project_approval_requests, p_request);
  if p_delivery_id is null or payload.email_id is distinct from
    (case when p_existing is null then 'manual:' else 'manual-update:' end || p_delivery_id::text)
    or (p_draft->>'recipientEmail') is distinct from payload.recipient_email then
    raise exception 'ข้อมูลร่างอีเมลไม่ถูกต้อง';
  end if;
  if p_existing is null then
    insert into public.project_approval_requests(
      id, project_id, recipient_email, token_hash, status, expires_at,
      requested_at, requested_by, requested_by_name, email_id, email_sent_at, email_error
    ) values (
      payload.id, payload.project_id, payload.recipient_email, payload.token_hash, 'pending', payload.expires_at,
      payload.requested_at, payload.requested_by, payload.requested_by_name, payload.email_id, null, ''
    ) returning * into saved;
  else
    update public.project_approval_requests set
      requested_at = payload.requested_at, requested_by = payload.requested_by,
      requested_by_name = payload.requested_by_name, email_id = payload.email_id,
      email_sent_at = null, email_error = ''
    where id = payload.id and project_id = payload.project_id and recipient_email = payload.recipient_email
      and requested_at = (p_existing->>'requested_at')::timestamptz
      and email_id = p_existing->>'email_id' and status <> 'revoked'
    returning * into saved;
    if not found then raise exception 'คำขอมีการเปลี่ยนแปลง กรุณาโหลดสถานะใหม่ก่อนเตรียมอีเมล'; end if;
  end if;
  insert into public.project_approval_manual_deliveries(id, request_id, prepared_at, prepared_by, draft)
    values (p_delivery_id, saved.id, payload.requested_at, payload.requested_by, p_draft);
  return next saved;
end;
$$;

-- Lock the canonical request while checking the delivery version. A concurrent
-- preparation cannot make confirmation apply to a different round.
create or replace function public.confirm_project_approval_manual_delivery(
  p_project_id uuid, p_request_id uuid, p_delivery_id uuid,
  p_confirmed_by uuid, p_confirmed_by_name text
) returns setof public.project_approval_manual_deliveries
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  current_request public.project_approval_requests%rowtype;
  saved public.project_approval_manual_deliveries%rowtype;
begin
  select * into current_request from public.project_approval_requests
    where id = p_request_id and project_id = p_project_id for update;
  if not found or current_request.status = 'revoked' or current_request.email_id not in
    ('manual:' || p_delivery_id::text, 'manual-update:' || p_delivery_id::text) then
    raise exception 'รอบอีเมลมีการเปลี่ยนแปลงหรือถูกยกเลิก กรุณาเปิดร่างล่าสุด';
  end if;
  if p_confirmed_by is null or coalesce(trim(p_confirmed_by_name), '') = '' then
    raise exception 'ไม่พบผู้ยืนยันการส่ง';
  end if;
  select * into saved from public.project_approval_manual_deliveries
    where id = p_delivery_id and request_id = p_request_id for update;
  if not found then raise exception 'ไม่พบร่างอีเมล กรุณาเตรียมอีเมลใหม่'; end if;
  if saved.confirmed_at is null then
    update public.project_approval_manual_deliveries set
      confirmed_at = now(), confirmed_by = p_confirmed_by, confirmed_by_name = p_confirmed_by_name
    where id = saved.id returning * into saved;
  end if;
  return next saved;
end;
$$;
revoke all on function public.prepare_project_approval_manual_delivery(jsonb,jsonb,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.confirm_project_approval_manual_delivery(uuid,uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.prepare_project_approval_manual_delivery(jsonb,jsonb,uuid,jsonb) to service_role;
grant execute on function public.confirm_project_approval_manual_delivery(uuid,uuid,uuid,uuid,text) to service_role;
