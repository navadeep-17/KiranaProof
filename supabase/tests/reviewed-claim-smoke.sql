-- KiranaProof: reviewed claims are chosen from CONFIRMED reconciliation findings.
-- This test creates synthetic users and rolls back ALL test records.
begin;
select set_config('request.jwt.claim.role','service_role',true);
do $verify$
declare
 v_owner uuid:=gen_random_uuid();
 v_other uuid:=gen_random_uuid();
 v_delivery uuid;
 v_clean uuid;
 v_invoice uuid;
 v_claim uuid;
 v_saved jsonb;
 v_findings jsonb;
 v_payload jsonb;
 v_supplier jsonb;
begin
 insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
 values(v_owner,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','kp-reviewed-owner@example.test','',now(),now(),now()),
 (v_other,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','kp-reviewed-other@example.test','',now(),now(),now());

 v_payload:='{"storeName":"Synthetic Store","supplierName":"Synthetic Distributor",
 "referenceNumber":"REVIEW-SHORT","baselineType":"INVOICE",
 "invoiceCompleteConfirmed":true,"unexpectedItemsChecked":true,
 "invoice":[{"id":"soap","productName":"Soap","variant":"Box","unit":"box","expected":"8"}],
 "receipts":[{"invoiceLineId":"soap","productName":"Soap","variant":"Box","unit":"box","received":"6","damaged":"1","verified":true}],
 "unexpected":[]}'::jsonb;

 v_delivery:=(public.kp_save_delivery(v_owner,gen_random_uuid(),v_payload)->>'id')::uuid;
 select id into v_invoice from public.invoice_lines where delivery_id=v_delivery;
 v_findings:=jsonb_build_object(
  'result','HAS_DISCREPANCY','fullyVerified',true,'unresolved','[]'::jsonb,
  'discrepancies',jsonb_build_array(
   jsonb_build_object('type','SHORTAGE','invoiceLineId',v_invoice,'productName','Soap',
     'unit','box','affectedQuantity',2,'detail','Two boxes missing'),
   jsonb_build_object('type','DAMAGE','invoiceLineId',v_invoice,'productName','Soap',
     'unit','box','affectedQuantity',1,'detail','One box damaged')
  ));
 perform public.kp_confirm_delivery(v_owner,v_delivery,1,v_findings);

 begin
  perform public.kp_approve_reviewed_claim(v_other,v_delivery,2,
    '[{"index":0,"note":"Unauthorized"}]'::jsonb);
  raise exception 'TEST_FAIL_CROSS_ACCOUNT';
 exception when others then
  if sqlerrm='TEST_FAIL_CROSS_ACCOUNT' then raise; end if;
 end;
 begin
  perform public.kp_approve_reviewed_claim(v_owner,v_delivery,2,
    '[{"index":0,"note":""},{"index":0,"note":""}]'::jsonb);
  raise exception 'TEST_FAIL_DUPLICATE_INDEX';
 exception when others then
  if sqlerrm='TEST_FAIL_DUPLICATE_INDEX' then raise; end if;
 end;
 begin
  perform public.kp_approve_reviewed_claim(v_owner,v_delivery,2,
    '[{"index":99,"note":"Invented item"}]'::jsonb);
  raise exception 'TEST_FAIL_INVENTED_ISSUE';
 exception when others then
  if sqlerrm='TEST_FAIL_INVENTED_ISSUE' then raise; end if;
 end;

 v_saved:=public.kp_approve_reviewed_claim(v_owner,v_delivery,2,
   '[{"index":1,"note":"Please replace damaged boxes."}]'::jsonb);
 v_claim:=(v_saved->>'claimId')::uuid;
 if (select count(*) from public.claim_items where claim_id=v_claim)<>1 then
  raise exception 'Wrong selected issue count';
 end if;
 if (select issue_type from public.claim_items where claim_id=v_claim)<>'DAMAGE'
  or (select affected_qty from public.claim_items where claim_id=v_claim)<>1 then
  raise exception 'Claim values were not copied from the confirmed snapshot';
 end if;
 if (select retailer_note from public.claim_items where claim_id=v_claim)<>'Please replace damaged boxes.' then
  raise exception 'Retailer note missing';
 end if;
 if (public.kp_approve_reviewed_claim(v_owner,v_delivery,2,
  '[{"index":0,"note":"Replay must not add another issue"}]'::jsonb)->>'claimId')<>v_claim::text then
  raise exception 'Repeated approval created a duplicate';
 end if;
 if (select count(*) from public.claim_items where claim_id=v_claim)<>1 then
  raise exception 'Repeated approval modified confirmed claim';
 end if;

 perform public.kp_issue_supplier_link(v_owner,v_claim,repeat('a',64),now()+interval '2 days');
 v_supplier:=public.kp_get_supplier_claim(repeat('a',64));
 if jsonb_array_length(v_supplier->'items')<>1
   or v_supplier->'items'->0->>'retailerNote'<>'Please replace damaged boxes.' then
  raise exception 'Supplier scope or note incorrect';
 end if;

 v_payload:=jsonb_set(jsonb_set(v_payload,'{receipts,0,received}','"8"'::jsonb),
   '{receipts,0,damaged}','"0"'::jsonb);
 v_payload:=jsonb_set(v_payload,'{referenceNumber}','"REVIEW-CLEAN"'::jsonb);
 v_clean:=(public.kp_save_delivery(v_owner,gen_random_uuid(),v_payload)->>'id')::uuid;
 perform public.kp_confirm_delivery(v_owner,v_clean,1,
   '{"result":"RECONCILED","fullyVerified":true,"discrepancies":[],"unresolved":[]}'::jsonb);
 begin
  perform public.kp_approve_reviewed_claim(v_owner,v_clean,2,
    '[{"index":0,"note":"Invented clean claim"}]'::jsonb);
  raise exception 'TEST_FAIL_CLEAN_CLAIM';
 exception when others then
  if sqlerrm='TEST_FAIL_CLEAN_CLAIM' then raise; end if;
 end;
 raise notice 'Reviewed claim, authorization, immutable amounts, supplier scope and clean guard passed';
end $verify$;
rollback;
