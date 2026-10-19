-- M4: Explicit approval, scoped supplier links, one supplier reply, owner resolution.
-- No automatic claims: kp_approve_claim must be called after a separate retailer action.

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  delivery_id uuid not null unique,
  status text not null default 'OPEN' check (status in ('OPEN','SUPPLIER_RESPONDED','RESOLVED')),
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now(),
  supplier_responded_at timestamptz,
  resolved_at timestamptz,
  resolution_type text check (resolution_type in ('REPLACED','CREDITED','OTHER')),
  resolution_note text,
  foreign key (delivery_id,store_id) references public.deliveries(id,store_id),
  unique (id,store_id),
  check (resolution_note is null or length(resolution_note)<=1000)
);

create table public.claim_items (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  invoice_line_id uuid references public.invoice_lines(id),
  issue_type text not null check (issue_type in
    ('SHORTAGE','EXCESS','DAMAGE','WRONG_ITEM','WRONG_VARIANT','UNEXPECTED_ITEM')),
  product_name text not null check (length(btrim(product_name))>0),
  unit text not null check (length(btrim(unit))>0),
  affected_qty numeric(12,3) check (affected_qty>=0),
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index idx_claim_items_claim on public.claim_items(claim_id);

create table public.claim_share_links (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.claims(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_claim_links_expiry on public.claim_share_links(expires_at);

create table public.supplier_responses (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.claims(id) on delete cascade,
  share_link_id uuid not null references public.claim_share_links(id),
  response_type text not null check (response_type in ('ACKNOWLEDGED','PROPOSED_RESOLUTION','DISPUTED')),
  note text not null default '' check (length(note)<=1000),
  responded_at timestamptz not null default now()
);

create index idx_claims_store on public.claims(store_id,approved_at desc);
create index idx_claims_delivery on public.claims(delivery_id);

alter table public.claims enable row level security;
alter table public.claim_items enable row level security;
alter table public.claim_share_links enable row level security;
alter table public.supplier_responses enable row level security;

revoke all on public.claims,public.claim_items,public.claim_share_links,public.supplier_responses from anon,authenticated;
grant select on public.claims,public.claim_items,public.supplier_responses to authenticated;
-- No authenticated/anon reads of hashed bearer credentials.
create policy claims_owner_read on public.claims for select to authenticated
  using (exists(select 1 from public.stores s
    where s.id=claims.store_id and s.owner_user_id=(select auth.uid())));
create policy claim_items_owner_read on public.claim_items for select to authenticated
  using (exists(select 1 from public.claims c join public.stores s on s.id=c.store_id
    where c.id=claim_items.claim_id and s.owner_user_id=(select auth.uid())));
create policy supplier_responses_owner_read on public.supplier_responses for select to authenticated
  using (exists(select 1 from public.claims c join public.stores s on s.id=c.store_id
    where c.id=supplier_responses.claim_id and s.owner_user_id=(select auth.uid())));

create or replace function public.kp_approve_claim(
  p_owner uuid,p_delivery uuid,p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path=''
as $fn$
declare
  v_store uuid;
  v_version integer;
  v_status text;
  v_claim uuid;
  v_run jsonb;
  v_line jsonb;
  v_invoice uuid;
  v_count integer:=0;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Trusted server required' using errcode='42501';
  end if;
  select d.store_id,d.version,d.status into v_store,v_version,v_status
  from public.deliveries d join public.stores s on s.id=d.store_id
  where d.id=p_delivery and s.owner_user_id=p_owner
  for update of d;
  if not found then raise exception 'Delivery not owned' using errcode='42501'; end if;
  if v_status<>'HAS_DISCREPANCY' then
    raise exception 'Only fully confirmed discrepancy deliveries can create claims' using errcode='23514';
  end if;
  select id into v_claim from public.claims where delivery_id=p_delivery;
  if v_claim is not null then
    return jsonb_build_object('claimId',v_claim,'replayed',true);
  end if;
  if p_expected_version is distinct from v_version then
    raise exception 'Delivery version changed' using errcode='40001';
  end if;
  select r.findings_json into v_run from public.reconciliation_runs r
  where r.delivery_id=p_delivery and r.delivery_version=v_version-1
    and r.result='HAS_DISCREPANCY'
  limit 1;
  if v_run is null or jsonb_typeof(v_run->'discrepancies')<>'array'
    or jsonb_array_length(v_run->'discrepancies')=0
    or coalesce(jsonb_array_length(v_run->'unresolved'),1)>0
    or (v_run->>'fullyVerified')::boolean is distinct from true then
    raise exception 'No complete confirmed discrepancy findings available' using errcode='23514';
  end if;
  insert into public.claims(store_id,delivery_id,approved_by)
    values(v_store,p_delivery,p_owner) returning id into v_claim;
  for v_line in select value from jsonb_array_elements(v_run->'discrepancies') loop
    v_invoice:=nullif(v_line->>'invoiceLineId','')::uuid;
    if (v_line->>'type') not in
      ('SHORTAGE','EXCESS','DAMAGE','WRONG_ITEM','WRONG_VARIANT','UNEXPECTED_ITEM')
       or nullif(btrim(v_line->>'productName'),'') is null
       or nullif(btrim(v_line->>'unit'),'') is null
       or (v_invoice is not null and not exists(
         select 1 from public.invoice_lines i where i.id=v_invoice and i.delivery_id=p_delivery
       )) then
      raise exception 'Invalid discrepancy snapshot' using errcode='23514';
    end if;
    insert into public.claim_items(
      claim_id,invoice_line_id,issue_type,product_name,unit,affected_qty,detail
    ) values (
      v_claim,v_invoice,v_line->>'type',btrim(v_line->>'productName'),
      btrim(v_line->>'unit'),nullif(v_line->>'affectedQuantity','')::numeric,
      left(coalesce(v_line->>'detail',''),500)
    );
    v_count:=v_count+1;
  end loop;
  if v_count=0 then raise exception 'Cannot approve an empty claim'; end if;
  insert into public.audit_events(store_id,delivery_id,actor_type,actor_id,event_type,payload_json)
  values(v_store,p_delivery,'RETAILER',p_owner,'CLAIM_APPROVED',
    jsonb_build_object('claim_id',v_claim,'item_count',v_count));
  return jsonb_build_object('claimId',v_claim,'replayed',false);
end $fn$;

create or replace function public.kp_issue_supplier_link(
  p_owner uuid,p_claim uuid,p_hash text,p_expires_at timestamptz
) returns jsonb
language plpgsql security definer set search_path=''
as $fn$
declare
  v_store uuid;
  v_delivery uuid;
  v_status text;
  v_link uuid;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Trusted server required' using errcode='42501';
  end if;
  if p_hash !~ '^[a-f0-9]{64}$'
    or p_expires_at<=now()+interval '1 hour'
    or p_expires_at>now()+interval '7 days 5 minutes' then
    raise exception 'Invalid share-link lifetime or hash' using errcode='23514';
  end if;
  select c.store_id,c.delivery_id,c.status into v_store,v_delivery,v_status
  from public.claims c join public.stores s on s.id=c.store_id and s.owner_user_id=p_owner
  where c.id=p_claim for update of c;
  if not found then raise exception 'Claim not owned' using errcode='42501'; end if;
  if v_status<>'OPEN' then raise exception 'Claim no longer accepts supplier replies' using errcode='23514'; end if;
  insert into public.claim_share_links(claim_id,token_hash,expires_at,revoked_at)
  values(p_claim,p_hash,p_expires_at,null)
  on conflict(claim_id) do update set token_hash=excluded.token_hash,
    expires_at=excluded.expires_at,revoked_at=null,created_at=now()
  returning id into v_link;
  insert into public.audit_events(store_id,delivery_id,actor_type,actor_id,event_type,payload_json)
  values(v_store,v_delivery,'RETAILER',p_owner,'SUPPLIER_LINK_ISSUED',
    jsonb_build_object('claim_id',p_claim,'expires_at',p_expires_at));
  return jsonb_build_object('linkId',v_link,'expiresAt',p_expires_at);
end $fn$;

create or replace function public.kp_get_supplier_claim(p_hash text)
returns jsonb
language plpgsql security definer set search_path=''
as $fn$
declare
  v_claim uuid;
  v_link uuid;
  v_supplier_name text;
  v_reference text;
  v_items jsonb;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Trusted server required' using errcode='42501';
  end if;
  select l.claim_id,l.id,s.name,d.reference_number
  into v_claim,v_link,v_supplier_name,v_reference
  from public.claim_share_links l join public.claims c on c.id=l.claim_id
  join public.deliveries d on d.id=c.delivery_id
  join public.suppliers s on s.id=d.supplier_id
  where l.token_hash=p_hash and l.revoked_at is null and l.expires_at>now()
    and c.status='OPEN';
  if not found then return null; end if;
  select jsonb_agg(jsonb_build_object('issueType',issue_type,'productName',product_name,
    'unit',unit,'affectedQuantity',affected_qty,'detail',detail) order by created_at)
  into v_items from public.claim_items where claim_id=v_claim;
  return jsonb_build_object('claimId',v_claim,'supplierName',v_supplier_name,
    'referenceNumber',v_reference,'items',coalesce(v_items,'[]'::jsonb));
end $fn$;

create or replace function public.kp_supplier_respond(
  p_hash text,p_type text,p_note text
) returns jsonb
language plpgsql security definer set search_path=''
as $fn$
declare
  v_claim uuid;
  v_store uuid;
  v_delivery uuid;
  v_link uuid;
  v_status text;
  v_responded uuid;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Trusted server required' using errcode='42501';
  end if;
  if p_type not in ('ACKNOWLEDGED','PROPOSED_RESOLUTION','DISPUTED')
    or p_note is null or length(p_note)>1000
    or (p_type<>'ACKNOWLEDGED' and length(btrim(p_note))<3) then
    raise exception 'Invalid supplier response' using errcode='23514';
  end if;
  select c.id,c.store_id,c.delivery_id,c.status,l.id
  into v_claim,v_store,v_delivery,v_status,v_link
  from public.claim_share_links l join public.claims c on c.id=l.claim_id
  where l.token_hash=p_hash and l.revoked_at is null and l.expires_at>now()
  for update of c;
  if not found then raise exception 'Link expired, revoked or invalid' using errcode='42501'; end if;
  if v_status<>'OPEN' then raise exception 'Claim already answered or closed' using errcode='23514'; end if;
  insert into public.supplier_responses(claim_id,share_link_id,response_type,note)
  values(v_claim,v_link,p_type,btrim(p_note)) returning id into v_responded;
  update public.claims set status='SUPPLIER_RESPONDED',supplier_responded_at=now()
  where id=v_claim;
  update public.claim_share_links set revoked_at=now() where id=v_link;
  insert into public.audit_events(store_id,delivery_id,actor_type,event_type,payload_json)
  values(v_store,v_delivery,'SUPPLIER','SUPPLIER_RESPONDED',
    jsonb_build_object('claim_id',v_claim,'response_type',p_type));
  return jsonb_build_object('responseId',v_responded,'status','SUPPLIER_RESPONDED');
end $fn$;

create or replace function public.kp_resolve_claim(
  p_owner uuid,p_claim uuid,p_type text,p_note text
) returns jsonb
language plpgsql security definer set search_path=''
as $fn$
declare
  v_store uuid;
  v_delivery uuid;
  v_status text;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Trusted server required' using errcode='42501';
  end if;
  if p_type not in ('REPLACED','CREDITED','OTHER')
     or p_note is null or length(btrim(p_note))<3 or length(p_note)>1000 then
    raise exception 'Invalid resolution details' using errcode='23514';
  end if;
  select c.store_id,c.delivery_id,c.status into v_store,v_delivery,v_status
  from public.claims c join public.stores s on s.id=c.store_id and s.owner_user_id=p_owner
  where c.id=p_claim for update of c;
  if not found then raise exception 'Claim not owned' using errcode='42501'; end if;
  if v_status='RESOLVED' then raise exception 'Already resolved' using errcode='23514'; end if;
  update public.claims set status='RESOLVED',resolved_at=now(),
    resolution_type=p_type,resolution_note=btrim(p_note) where id=p_claim;
  update public.claim_share_links set revoked_at=now() where claim_id=p_claim and revoked_at is null;
  insert into public.audit_events(store_id,delivery_id,actor_type,actor_id,event_type,payload_json)
  values(v_store,v_delivery,'RETAILER',p_owner,'CLAIM_RESOLVED',
    jsonb_build_object('claim_id',p_claim,'resolution_type',p_type));
  return jsonb_build_object('claimId',p_claim,'status','RESOLVED');
end $fn$;

revoke all on function public.kp_approve_claim(uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.kp_issue_supplier_link(uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.kp_get_supplier_claim(text) from public,anon,authenticated;
revoke all on function public.kp_supplier_respond(text,text,text) from public,anon,authenticated;
revoke all on function public.kp_resolve_claim(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.kp_approve_claim(uuid,uuid,integer) to service_role;
grant execute on function public.kp_issue_supplier_link(uuid,uuid,text,timestamptz) to service_role;
grant execute on function public.kp_get_supplier_claim(text) to service_role;
grant execute on function public.kp_supplier_respond(text,text,text) to service_role;
grant execute on function public.kp_resolve_claim(uuid,uuid,text,text) to service_role;
