-- Product hardening: allow line-by-line claim inclusion and retailer notes.
-- Source of truth stays the immutable, server-confirmed reconciliation run.
alter table public.claim_items
  add column if not exists retailer_note text not null default ''
  check(length(retailer_note)<=500);

create or replace function public.kp_approve_reviewed_claim(
  p_owner uuid,
  p_delivery uuid,
  p_expected_version integer,
  p_selection jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $kp$
declare
 v_store uuid;
 v_version integer;
 v_status text;
 v_claim uuid;
 v_run jsonb;
 v_issues jsonb;
 v_entry jsonb;
 v_item jsonb;
 v_index integer;
 v_indices integer[]:='{}';
 v_note text;
 v_invoice uuid;
 v_included integer:=0;
 v_total integer;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
   raise exception 'Trusted server required' using errcode='42501';
 end if;
 if p_owner is null or p_delivery is null or p_expected_version is null then
   raise exception 'Missing claim approval arguments' using errcode='23514';
 end if;
 select d.store_id,d.version,d.status into v_store,v_version,v_status
 from public.deliveries d join public.stores s
   on s.id=d.store_id and s.owner_user_id=p_owner
 where d.id=p_delivery for update of d;
 if not found then raise exception 'Delivery not found or not owned' using errcode='42501'; end if;
 if v_status<>'HAS_DISCREPANCY' then
   raise exception 'Only verified discrepancy deliveries can be claimed' using errcode='23514';
 end if;
 select id into v_claim from public.claims where delivery_id=p_delivery;
 if found then return jsonb_build_object('claimId',v_claim,'replayed',true); end if;
 if p_expected_version is distinct from v_version then
   raise exception 'Delivery changed; refresh claim review' using errcode='40001';
 end if;
 select r.findings_json into v_run from public.reconciliation_runs r
 where r.delivery_id=p_delivery and r.delivery_version=v_version-1
   and r.result='HAS_DISCREPANCY'
 limit 1;
 v_issues:=v_run->'discrepancies';
 if v_run is null or (v_run->>'fullyVerified')::boolean is distinct from true
   or jsonb_typeof(v_run->'unresolved')<>'array'
   or jsonb_array_length(v_run->'unresolved')<>0
   or jsonb_typeof(v_issues)<>'array'
   or jsonb_array_length(v_issues)<1 then
     raise exception 'Complete confirmed findings required' using errcode='23514';
 end if;
 v_total:=jsonb_array_length(v_issues);
 if jsonb_typeof(p_selection)<>'array' or jsonb_array_length(p_selection)<1
   or jsonb_array_length(p_selection)>least(v_total,75) then
     raise exception 'Choose at least one valid discrepancy line' using errcode='23514';
 end if;
 -- The client supplies only the index and a note, NEVER product, type or quantity.
 for v_entry in select value from jsonb_array_elements(p_selection) loop
   if jsonb_typeof(v_entry)<>'object'
     or jsonb_typeof(v_entry->'index')<>'number'
     or (v_entry->>'index') !~ '^(0|[1-9][0-9]*)$'
     or jsonb_typeof(v_entry->'note')<>'string' then
       raise exception 'Invalid claim review line' using errcode='23514';
   end if;
   v_index:=(v_entry->>'index')::integer;
   v_note:=btrim(v_entry->>'note');
   if v_index<0 or v_index>=v_total or v_index=any(v_indices)
      or length(v_note)>500 then
     raise exception 'Duplicate or out-of-range claim line' using errcode='23514';
   end if;
   v_indices:=array_append(v_indices,v_index);
 end loop;
 insert into public.claims(store_id,delivery_id,approved_by)
 values(v_store,p_delivery,p_owner) returning id into v_claim;
 for v_entry in select value from jsonb_array_elements(p_selection) loop
   v_index:=(v_entry->>'index')::integer;
   v_note:=btrim(v_entry->>'note');
   v_item:=v_issues->v_index;
   v_invoice:=nullif(v_item->>'invoiceLineId','')::uuid;
   if (v_item->>'type') not in
     ('SHORTAGE','EXCESS','DAMAGE','WRONG_ITEM','WRONG_VARIANT','UNEXPECTED_ITEM')
     or nullif(btrim(v_item->>'productName'),'') is null
     or nullif(btrim(v_item->>'unit'),'') is null
     or (v_invoice is not null and not exists(
        select 1 from public.invoice_lines i
        where i.id=v_invoice and i.delivery_id=p_delivery
     )) then
       raise exception 'Confirmed finding is invalid' using errcode='23514';
   end if;
   insert into public.claim_items(
     claim_id,invoice_line_id,issue_type,product_name,unit,
     affected_qty,detail,retailer_note
   ) values (
     v_claim,v_invoice,v_item->>'type',btrim(v_item->>'productName'),
     btrim(v_item->>'unit'),nullif(v_item->>'affectedQuantity','')::numeric,
     left(coalesce(v_item->>'detail',''),500),v_note
   );
   v_included:=v_included+1;
 end loop;
 insert into public.audit_events(
   store_id,delivery_id,actor_type,actor_id,event_type,payload_json
 ) values(
   v_store,p_delivery,'RETAILER',p_owner,'CLAIM_APPROVED',
   jsonb_build_object('claim_id',v_claim,'item_count',v_included,
     'confirmed_issue_count',v_total,'reviewed',true)
 );
 return jsonb_build_object('claimId',v_claim,'replayed',false,
   'itemCount',v_included);
end $kp$;

revoke all on function public.kp_approve_reviewed_claim(uuid,uuid,integer,jsonb)
 from public,anon,authenticated;
grant execute on function public.kp_approve_reviewed_claim(uuid,uuid,integer,jsonb)
 to service_role;

create or replace function public.kp_get_supplier_claim(p_hash text)
returns jsonb language plpgsql security definer set search_path=''
as $kp$
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
 select jsonb_agg(jsonb_build_object(
   'issueType',issue_type,'productName',product_name,
   'unit',unit,'affectedQuantity',affected_qty,
   'detail',detail,'retailerNote',retailer_note
 ) order by created_at)
 into v_items from public.claim_items where claim_id=v_claim;
 return jsonb_build_object(
   'claimId',v_claim,'supplierName',v_supplier_name,
   'referenceNumber',v_reference,'items',coalesce(v_items,'[]'::jsonb)
 );
end $kp$;

revoke all on function public.kp_get_supplier_claim(text) from public,anon,authenticated;
grant execute on function public.kp_get_supplier_claim(text) to service_role;