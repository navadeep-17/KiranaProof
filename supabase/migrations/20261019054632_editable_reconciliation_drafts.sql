-- Development-only: allow incomplete baseline drafts, and edit only unconfirmed deliveries.
CREATE OR REPLACE FUNCTION public.kp_save_delivery(p_owner uuid, p_request_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_store uuid;
  v_supplier uuid;
  v_delivery uuid;
  v_existing_owner uuid;
  v_line jsonb;
  v_receipt jsonb;
  v_line_id uuid;
  v_index integer := 0;
  v_map jsonb := '{}'::jsonb;
  v_client_id text;
  v_baseline text;
  v_supplier_name text;
  v_invoice jsonb;
  v_receipts jsonb;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'Only the trusted server may save deliveries' using errcode='42501';
  end if;
  if p_owner is null or p_request_id is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid delivery payload';
  end if;

  select d.id,s.owner_user_id into v_delivery,v_existing_owner
  from public.deliveries d join public.stores s on s.id=d.store_id
  where d.client_request_id=p_request_id;
  if found then
    if v_existing_owner <> p_owner then
      raise exception 'Request id already belongs to a different retailer' using errcode='42501';
    end if;
    return jsonb_build_object('id',v_delivery,'version',1,'replayed',true);
  end if;

  v_invoice:=p_payload->'invoice';
  v_receipts:=p_payload->'receipts';
  v_baseline:=p_payload->>'baselineType';
  v_supplier_name:=btrim(p_payload->>'supplierName');
  if v_baseline not in ('INVOICE','ORDER')
    or nullif(v_supplier_name,'') is null
    or nullif(btrim(p_payload->>'referenceNumber'),'') is null
    or jsonb_typeof(v_invoice)<>'array'
    or jsonb_array_length(v_invoice) < 1
    or jsonb_array_length(v_invoice) > 75
    or jsonb_typeof(v_receipts)<>'array'
    or jsonb_typeof(p_payload->'unexpected')<>'array'
  then
    raise exception 'Incomplete invoice baseline or invalid delivery payload';
  end if;

  insert into public.stores(owner_user_id,name)
  values (p_owner,coalesce(nullif(btrim(p_payload->>'storeName'),''),'My Kirana Store'))
  on conflict (owner_user_id) do update set owner_user_id=excluded.owner_user_id
  returning id into v_store;

  select id into v_supplier from public.suppliers
  where store_id=v_store and lower(name)=lower(v_supplier_name) order by created_at limit 1;
  if v_supplier is null then
    insert into public.suppliers(store_id,name) values(v_store,v_supplier_name)
    returning id into v_supplier;
  end if;

  insert into public.deliveries(
    store_id,supplier_id,baseline_type,reference_number,status,
    invoice_complete_confirmed,unexpected_items_checked,client_request_id
  )
  values(
    v_store,v_supplier,v_baseline,btrim(p_payload->>'referenceNumber'),'NEEDS_REVIEW',
    (p_payload->>'invoiceCompleteConfirmed')::boolean,
    coalesce((p_payload->>'unexpectedItemsChecked')::boolean,false),
    p_request_id
  ) returning id into v_delivery;

  for v_line in select value from jsonb_array_elements(v_invoice)
  loop
    v_index:=v_index+1;
    v_client_id:=v_line->>'id';
    if nullif(v_client_id,'') is null or v_map ? v_client_id then
      raise exception 'Missing or duplicate invoice line identifier';
    end if;
    v_line_id:=gen_random_uuid();
    insert into public.invoice_lines(
      id,delivery_id,line_no,product_name,variant,unit,expected_qty
    ) values(
      v_line_id,v_delivery,v_index,
      btrim(v_line->>'productName'),
      coalesce(v_line->>'variant',''),
      btrim(v_line->>'unit'),
      (v_line->>'expected')::numeric
    );
    v_map:=v_map||jsonb_build_object(v_client_id,v_line_id::text);
  end loop;

  for v_receipt in select value from jsonb_array_elements(v_receipts)
  loop
    v_client_id:=v_receipt->>'invoiceLineId';
    if not(v_map ? v_client_id) then
      raise exception 'Receipt references an invoice line that does not exist';
    end if;
    insert into public.receipt_lines(
      delivery_id,invoice_line_id,received_product_name,received_variant,
      unit,received_qty,damaged_qty,identity_confirmed,condition_confirmed
    ) values(
      v_delivery,(v_map->>v_client_id)::uuid,
      coalesce(v_receipt->>'productName',''),
      coalesce(v_receipt->>'variant',''),
      coalesce(v_receipt->>'unit',''),
      nullif(v_receipt->>'received','')::numeric,
      nullif(v_receipt->>'damaged','')::numeric,
      coalesce((v_receipt->>'verified')::boolean,false),
      coalesce((v_receipt->>'verified')::boolean,false)
    );
  end loop;

  for v_receipt in select value from jsonb_array_elements(p_payload->'unexpected')
  loop
    insert into public.receipt_lines(
      delivery_id,invoice_line_id,received_product_name,received_variant,
      unit,received_qty,damaged_qty,identity_confirmed,condition_confirmed
    ) values(
      v_delivery,null,
      btrim(v_receipt->>'productName'),
      coalesce(v_receipt->>'variant',''),
      coalesce(v_receipt->>'unit',''),
      nullif(v_receipt->>'received','')::numeric,
      nullif(v_receipt->>'damaged','')::numeric,
      coalesce((v_receipt->>'verified')::boolean,false),
      coalesce((v_receipt->>'verified')::boolean,false)
    );
  end loop;

  insert into public.audit_events(store_id,delivery_id,actor_type,actor_id,event_type,payload_json)
  values(v_store,v_delivery,'RETAILER',p_owner,'DELIVERY_CREATED',jsonb_build_object('line_count',v_index));
  return jsonb_build_object('id',v_delivery,'version',1,'replayed',false);
end;
$function$
;
create or replace function public.kp_update_delivery(
  p_owner uuid, p_delivery uuid, p_expected_version integer, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $kp$
declare
 v_store uuid;
 v_status text;
 v_version integer;
 v_supplier uuid;
 v_supplier_name text;
 v_baseline text;
 v_invoice jsonb;
 v_receipts jsonb;
 v_entry jsonb;
 v_client_id text;
 v_line_id uuid;
 v_counter integer := 0;
 v_mapping jsonb := '{}'::jsonb;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
   raise exception 'Trusted server required' using errcode='42501';
 end if;
 if p_owner is null or p_delivery is null or p_expected_version is null or jsonb_typeof(p_payload) <> 'object' then
   raise exception 'Invalid update arguments';
 end if;
 select d.store_id,d.status,d.version into v_store,v_status,v_version
 from public.deliveries d join public.stores s on s.id=d.store_id
 where d.id=p_delivery and s.owner_user_id=p_owner
 for update of d;
 if not found then raise exception 'Delivery not found or not owned' using errcode='42501'; end if;
 if v_version <> p_expected_version then raise exception 'Delivery has changed' using errcode='40001'; end if;
 if v_status not in ('DRAFT','NEEDS_REVIEW') then
   raise exception 'Cannot edit a confirmed delivery' using errcode='23514';
 end if;
 v_invoice:=p_payload->'invoice';
 v_receipts:=p_payload->'receipts';
 v_supplier_name:=btrim(p_payload->>'supplierName');
 v_baseline:=p_payload->>'baselineType';
 if v_baseline not in ('INVOICE','ORDER')
   or nullif(v_supplier_name,'') is null
   or nullif(btrim(p_payload->>'referenceNumber'),'') is null
   or jsonb_typeof(v_invoice) <> 'array'
   or jsonb_array_length(v_invoice) < 1
   or jsonb_array_length(v_invoice) > 75
   or jsonb_typeof(v_receipts) <> 'array'
   or jsonb_array_length(v_receipts) > 100
   or jsonb_typeof(p_payload->'unexpected') <> 'array'
   or jsonb_array_length(p_payload->'unexpected') > 25
 then
   raise exception 'Invalid delivery draft';
 end if;
 select id into v_supplier from public.suppliers
 where store_id=v_store and lower(name)=lower(v_supplier_name)
 order by created_at limit 1;
 if v_supplier is null then
   insert into public.suppliers(store_id,name) values(v_store,v_supplier_name)
   returning id into v_supplier;
 end if;
 -- Replacing child rows is safe only for UNCONFIRMED deliveries.
 delete from public.receipt_lines where delivery_id=p_delivery;
 delete from public.invoice_lines where delivery_id=p_delivery;
 for v_entry in select value from jsonb_array_elements(v_invoice) loop
   v_counter:=v_counter+1;
   v_client_id:=v_entry->>'id';
   if nullif(v_client_id,'') is null or v_mapping ? v_client_id then
     raise exception 'Duplicate or empty invoice line id';
   end if;
   v_line_id:=gen_random_uuid();
   insert into public.invoice_lines(id,delivery_id,line_no,product_name,variant,unit,expected_qty)
   values(v_line_id,p_delivery,v_counter,btrim(v_entry->>'productName'),
     coalesce(v_entry->>'variant',''),btrim(v_entry->>'unit'),(v_entry->>'expected')::numeric);
   v_mapping:=v_mapping||jsonb_build_object(v_client_id,v_line_id::text);
 end loop;
 for v_entry in select value from jsonb_array_elements(v_receipts) loop
   v_client_id:=v_entry->>'invoiceLineId';
   if not (v_mapping ? v_client_id) then raise exception 'Receipt does not match invoice'; end if;
   insert into public.receipt_lines(
     delivery_id,invoice_line_id,received_product_name,received_variant,unit,
     received_qty,damaged_qty,identity_confirmed,condition_confirmed
   ) values(
     p_delivery,(v_mapping->>v_client_id)::uuid,coalesce(v_entry->>'productName',''),
     coalesce(v_entry->>'variant',''),coalesce(v_entry->>'unit',''),
     nullif(v_entry->>'received','')::numeric,nullif(v_entry->>'damaged','')::numeric,
     coalesce((v_entry->>'verified')::boolean,false),coalesce((v_entry->>'verified')::boolean,false)
   );
 end loop;
 for v_entry in select value from jsonb_array_elements(p_payload->'unexpected') loop
   insert into public.receipt_lines(
     delivery_id,invoice_line_id,received_product_name,received_variant,unit,
     received_qty,damaged_qty,identity_confirmed,condition_confirmed
   ) values(
     p_delivery,null,btrim(v_entry->>'productName'),coalesce(v_entry->>'variant',''),
     coalesce(v_entry->>'unit',''),nullif(v_entry->>'received','')::numeric,
     nullif(v_entry->>'damaged','')::numeric,coalesce((v_entry->>'verified')::boolean,false),
     coalesce((v_entry->>'verified')::boolean,false)
   );
 end loop;
 update public.deliveries set
   supplier_id=v_supplier,baseline_type=v_baseline,reference_number=btrim(p_payload->>'referenceNumber'),
   invoice_complete_confirmed=coalesce((p_payload->>'invoiceCompleteConfirmed')::boolean,false),
   unexpected_items_checked=coalesce((p_payload->>'unexpectedItemsChecked')::boolean,false),
   status='NEEDS_REVIEW',version=version+1,confirmed_at=null,updated_at=now()
 where id=p_delivery;
 insert into public.audit_events(store_id,delivery_id,actor_type,actor_id,event_type,payload_json)
 values(v_store,p_delivery,'RETAILER',p_owner,'DELIVERY_DRAFT_UPDATED',
   jsonb_build_object('previous_version',v_version,'version',v_version+1,'line_count',v_counter));
 return jsonb_build_object('id',p_delivery,'version',v_version+1,'status','NEEDS_REVIEW');
end
$kp$;
revoke all on function public.kp_update_delivery(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.kp_update_delivery(uuid,uuid,integer,jsonb) to service_role;
