-- KiranaProof draft lifecycle smoke test.
-- Run in the development Supabase SQL editor using an admin connection only.
-- Every synthetic user, invoice and audit row is rolled back at the end.
begin;
select set_config('request.jwt.claim.role','service_role',true);

do $verify$
declare
  owner_id uuid := gen_random_uuid();
  outsider_id uuid := gen_random_uuid();
  request_id uuid := gen_random_uuid();
  delivery_id uuid;
  original jsonb;
  completed jsonb;
  created jsonb;
  edited jsonb;
  finalized jsonb;
begin
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
  values(owner_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','kp-synthetic-owner@example.test','',now(),now(),now()),
        (outsider_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','kp-synthetic-outsider@example.test','',now(),now(),now());

  original := '{"storeName":"Synthetic Kirana","supplierName":"Synthetic Supplier","referenceNumber":"TEST-DRAFT","baselineType":"INVOICE",
     "invoiceCompleteConfirmed":false,"unexpectedItemsChecked":false,
     "invoice":[{"id":"soap","productName":"Soap","variant":"Box","unit":"box","expected":"8"}],
     "receipts":[],"unexpected":[]}'::jsonb;

  created := public.kp_save_delivery(owner_id,request_id,original);
  delivery_id := (created->>'id')::uuid;
  if (select status from public.deliveries where id=delivery_id) <> 'NEEDS_REVIEW' then
    raise exception 'Incomplete delivery was not saved pending review';
  end if;
  if (public.kp_save_delivery(owner_id,request_id,original)->>'id') <> delivery_id::text then
    raise exception 'Idempotent create failed';
  end if;

  completed := jsonb_set(jsonb_set(original,'{invoiceCompleteConfirmed}','true'::jsonb),'{unexpectedItemsChecked}','true'::jsonb);
  completed := jsonb_set(completed,'{receipts}',
     '[{"invoiceLineId":"soap","productName":"Soap","variant":"Box","unit":"box","received":"8","damaged":"0","verified":true}]'::jsonb);
  edited := public.kp_update_delivery(owner_id,delivery_id,1,completed);
  if (edited->>'version') <> '2' then raise exception 'Edit did not bump version'; end if;
  if (select count(*) from public.receipt_lines where delivery_id=delivery_id) <> 1 then
    raise exception 'Edit did not replace receipt lines';
  end if;

  begin
    perform public.kp_update_delivery(owner_id,delivery_id,1,completed);
    raise exception 'TEST_FAILURE_STALE_UPDATE_ACCEPTED';
  exception when others then
    if sqlerrm = 'TEST_FAILURE_STALE_UPDATE_ACCEPTED' then raise; end if;
  end;

  begin
    perform public.kp_update_delivery(outsider_id,delivery_id,2,completed);
    raise exception 'TEST_FAILURE_CROSS_OWNER_UPDATE_ACCEPTED';
  exception when others then
    if sqlerrm = 'TEST_FAILURE_CROSS_OWNER_UPDATE_ACCEPTED' then raise; end if;
  end;

  finalized := public.kp_confirm_delivery(owner_id,delivery_id,2,
    '{"result":"RECONCILED","fullyVerified":true,"discrepancies":[],"unresolved":[]}'::jsonb);
  if (finalized->>'status') <> 'RECONCILED' then raise exception 'Expected clean confirmation'; end if;

  begin
    perform public.kp_update_delivery(owner_id,delivery_id,3,completed);
    raise exception 'TEST_FAILURE_CONFIRMED_UPDATE_ACCEPTED';
  exception when others then
    if sqlerrm = 'TEST_FAILURE_CONFIRMED_UPDATE_ACCEPTED' then raise; end if;
  end;

  raise notice 'Draft lifecycle regression checks passed; transaction will roll back.';
end;
$verify$;
rollback;
