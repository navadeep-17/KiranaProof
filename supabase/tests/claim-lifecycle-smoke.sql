-- M4 supplier/retailer claim lifecycle smoke. All synthetic data is rolled back.
-- Run against development Supabase with an admin SQL editor connection.
begin;
select set_config('request.jwt.claim.role','service_role',true);
do $test$
declare
  own uuid:=gen_random_uuid();
  outsider uuid:=gen_random_uuid();
  clean_delivery uuid;
  bad_delivery uuid;
  line_id uuid;
  v_claim_id uuid;
  finding jsonb;
  payload jsonb;
begin
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
  values(own,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','kp-claim-owner@example.test','',now(),now(),now()),
        (outsider,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','kp-claim-other@example.test','',now(),now(),now());

  payload:='{"storeName":"Test","supplierName":"Distributor","referenceNumber":"TEST-CLEAN",
    "baselineType":"INVOICE","invoiceCompleteConfirmed":true,"unexpectedItemsChecked":true,
    "invoice":[{"id":"a","productName":"Soap","variant":"Box","unit":"box","expected":"8"}],
    "receipts":[{"invoiceLineId":"a","productName":"Soap","variant":"Box","unit":"box","received":"8","damaged":"0","verified":true}],
    "unexpected":[]}'::jsonb;
  clean_delivery:=(public.kp_save_delivery(own,gen_random_uuid(),payload)->>'id')::uuid;
  perform public.kp_confirm_delivery(own,clean_delivery,1,
    '{"result":"RECONCILED","fullyVerified":true,"discrepancies":[],"unresolved":[]}'::jsonb);
  begin
    perform public.kp_approve_claim(own,clean_delivery,2);
    raise exception 'UNEXPECTED_CLEAN_CLAIM';
  exception when others then
    if sqlerrm='UNEXPECTED_CLEAN_CLAIM' then raise; end if;
  end;

  payload:=jsonb_set(payload,'{referenceNumber}','"TEST-SHORTAGE"'::jsonb);
  payload:=jsonb_set(payload,'{receipts,0,received}','"6"'::jsonb);
  payload:=jsonb_set(payload,'{receipts,0,damaged}','"1"'::jsonb);
  bad_delivery:=(public.kp_save_delivery(own,gen_random_uuid(),payload)->>'id')::uuid;
  select id into line_id from public.invoice_lines where delivery_id=bad_delivery;
  finding:=jsonb_build_object('result','HAS_DISCREPANCY','fullyVerified',true,'unresolved','[]'::jsonb,
    'discrepancies',jsonb_build_array(
      jsonb_build_object('type','SHORTAGE','invoiceLineId',line_id,'productName','Soap','unit','box','affectedQuantity',2,'detail','Two missing'),
      jsonb_build_object('type','DAMAGE','invoiceLineId',line_id,'productName','Soap','unit','box','affectedQuantity',1,'detail','One damaged')
    ));
  perform public.kp_confirm_delivery(own,bad_delivery,1,finding);
  begin
    perform public.kp_approve_claim(outsider,bad_delivery,2);
    raise exception 'UNEXPECTED_CROSS_OWNER_APPROVAL';
  exception when others then
    if sqlerrm='UNEXPECTED_CROSS_OWNER_APPROVAL' then raise; end if;
  end;
  v_claim_id:=(public.kp_approve_claim(own,bad_delivery,2)->>'claimId')::uuid;
  if (select count(*) from public.claim_items where claim_id=v_claim_id)<>2 then
    raise exception 'Missing approved claim items';
  end if;
  if (public.kp_approve_claim(own,bad_delivery,2)->>'claimId')<>v_claim_id::text then
    raise exception 'Duplicate approval changed claim';
  end if;
  perform public.kp_issue_supplier_link(own,v_claim_id,repeat('a',64),now()+interval '2 days');
  if public.kp_get_supplier_claim(repeat('a',64)) is null then
    raise exception 'Valid token inaccessible';
  end if;
  if (public.kp_revoke_supplier_link(own,v_claim_id)->>'revoked')<>'true' then
    raise exception 'Explicit revocation failed';
  end if;
  if public.kp_get_supplier_claim(repeat('a',64)) is not null then
    raise exception 'Revoked token still works';
  end if;
  perform public.kp_issue_supplier_link(own,v_claim_id,repeat('b',64),now()+interval '2 days');
  if public.kp_get_supplier_claim(repeat('b',64)) is null then
    raise exception 'Reissued token failed';
  end if;
  update public.claim_share_links set expires_at=now()-interval '1 minute'
  where claim_id=v_claim_id;
  if public.kp_get_supplier_claim(repeat('b',64)) is not null then
    raise exception 'Expired token still works';
  end if;
  perform public.kp_issue_supplier_link(own,v_claim_id,repeat('c',64),now()+interval '2 days');
  perform public.kp_supplier_respond(repeat('c',64),'PROPOSED_RESOLUTION','Replacement by Friday.');
  if public.kp_get_supplier_claim(repeat('c',64)) is not null then
    raise exception 'Used token still works';
  end if;
  begin
    perform public.kp_supplier_respond(repeat('c',64),'ACKNOWLEDGED','');
    raise exception 'UNEXPECTED_SECOND_RESPONSE';
  exception when others then
    if sqlerrm='UNEXPECTED_SECOND_RESPONSE' then raise; end if;
  end;
  begin
    perform public.kp_resolve_claim(outsider,v_claim_id,'OTHER','Fake settlement');
    raise exception 'UNEXPECTED_OTHER_OWNER_RESOLUTION';
  exception when others then
    if sqlerrm='UNEXPECTED_OTHER_OWNER_RESOLUTION' then raise; end if;
  end;
  perform public.kp_resolve_claim(own,v_claim_id,'REPLACED','Replacement received.');
  if (select status from public.claims where id=v_claim_id)<>'RESOLVED' then
    raise exception 'Resolution not recorded';
  end if;
end $test$;
rollback;
