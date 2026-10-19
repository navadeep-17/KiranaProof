-- Revoke a supplier bearer link without rotating it or resolving the claim.
create or replace function public.kp_revoke_supplier_link(p_owner uuid,p_claim uuid)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
  v_store uuid;
  v_delivery uuid;
  v_count integer:=0;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Trusted server required' using errcode='42501';
  end if;
  select c.store_id,c.delivery_id into v_store,v_delivery
  from public.claims c
  join public.stores s on s.id=c.store_id and s.owner_user_id=p_owner
  where c.id=p_claim for update of c;
  if not found then raise exception 'Claim not owned' using errcode='42501'; end if;
  update public.claim_share_links set revoked_at=now()
  where claim_id=p_claim and revoked_at is null;
  get diagnostics v_count=row_count;
  if v_count>0 then
    insert into public.audit_events(store_id,delivery_id,actor_type,actor_id,event_type,payload_json)
    values(v_store,v_delivery,'RETAILER',p_owner,'SUPPLIER_LINK_REVOKED',
      jsonb_build_object('claim_id',p_claim));
  end if;
  return jsonb_build_object('claimId',p_claim,'revoked',v_count>0);
end $fn$;

revoke all on function public.kp_revoke_supplier_link(uuid,uuid) from public,anon,authenticated;
grant execute on function public.kp_revoke_supplier_link(uuid,uuid) to service_role;
