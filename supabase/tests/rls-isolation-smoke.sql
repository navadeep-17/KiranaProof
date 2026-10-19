-- RLS and RPC grants: synthetic users in an ALL-ROLLBACK transaction.
-- Admin-only test; never run against real user data or a production project.
begin;
select set_config('request.jwt.claim.role','service_role',true);
do $setup$
declare
 owner_id uuid:=gen_random_uuid();
 other_id uuid:=gen_random_uuid();
 saved jsonb;
begin
 insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
 values(owner_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','kp-rls-owner@example.test','',now(),now(),now()),
 (other_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','kp-rls-outsider@example.test','',now(),now(),now());
 saved:=public.kp_save_delivery(owner_id,gen_random_uuid(),
 '{"storeName":"RLS Test","supplierName":"RLS Supplier","referenceNumber":"RLS-1",
 "baselineType":"INVOICE","invoiceCompleteConfirmed":false,"unexpectedItemsChecked":false,
 "invoice":[{"id":"x","productName":"Soap","variant":"","unit":"box","expected":"5"}],
 "receipts":[],"unexpected":[]}'::jsonb);
 perform set_config('test.kp_outsider',other_id::text,true);
 if saved->>'id' is null then raise exception 'Synthetic test setup failed'; end if;
end $setup$;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',current_setting('test.kp_outsider'),true);
do $verify$
begin
 if (select count(*) from public.stores) <> 0 then raise exception 'Store leaked'; end if;
 if (select count(*) from public.suppliers) <> 0 then raise exception 'Supplier leaked'; end if;
 if (select count(*) from public.deliveries) <> 0 then raise exception 'Delivery leaked'; end if;
 if (select count(*) from public.invoice_lines) <> 0 then raise exception 'Invoice leaked'; end if;
 if (select count(*) from public.receipt_lines) <> 0 then raise exception 'Receipt leaked'; end if;
 if (select count(*) from public.reconciliation_runs) <> 0 then raise exception 'Reconciliation leaked'; end if;
 if (select count(*) from public.audit_events) <> 0 then raise exception 'Audit leaked'; end if;
 if has_function_privilege('authenticated','public.kp_save_delivery(uuid,uuid,jsonb)','execute') then raise exception 'Create RPC exposed'; end if;
 if has_function_privilege('authenticated','public.kp_update_delivery(uuid,uuid,integer,jsonb)','execute') then raise exception 'Edit RPC exposed'; end if;
 if has_function_privilege('authenticated','public.kp_confirm_delivery(uuid,uuid,integer,jsonb)','execute') then raise exception 'Confirm RPC exposed'; end if;
end $verify$;
rollback;
