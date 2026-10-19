import { NextRequest, NextResponse } from "next/server";
import { checkWriteRequest } from "@/lib/deliveries/write-guards";
import { readBoundedJson,RequestBodyError } from "@/lib/http/bounded-body";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmDeliverySchema } from "@/lib/deliveries/schema";
import { toStoredDraft } from "@/lib/deliveries/read";
import { reconcile } from "@/lib/reconciliation/engine";

export const runtime="nodejs";

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const guard = checkWriteRequest(request);
  if (guard) return NextResponse.json({error:guard.error},{status:guard.status});
  const {id}=await params;
  if(!z.uuid().safeParse(id).success) return NextResponse.json({error:"Invalid delivery id."},{status:400});
  try {
    const userClient=await createServerSupabaseClient();
    const {data:auth,error:authError}=await userClient.auth.getUser();
    if(authError||!auth.user) return NextResponse.json({error:"Authentication required."},{status:401});
    const body=confirmDeliverySchema.parse(await readBoundedJson(request));
    const admin=createAdminClient();
    const {data:store,error:storeError}=await admin.from("stores")
      .select("id").eq("owner_user_id",auth.user.id).maybeSingle();
    if(storeError||!store) return NextResponse.json({error:"Store not found."},{status:404});
    const {data:delivery,error:deliveryError}=await admin.from("deliveries")
      .select("id,store_id,version,status,invoice_complete_confirmed,unexpected_items_checked")
      .eq("id",id).eq("store_id",store.id).maybeSingle();
    if(deliveryError||!delivery) return NextResponse.json({error:"Delivery not found."},{status:404});
    if(delivery.version!==body.expectedVersion) return NextResponse.json({error:"Delivery changed; refresh first."},{status:409});
    if(!["DRAFT","NEEDS_REVIEW"].includes(delivery.status))
      return NextResponse.json({error:"Delivery already confirmed."},{status:409});

    const [invoices,receipts]=await Promise.all([
      admin.from("invoice_lines").select("id,product_name,variant,unit,expected_qty").eq("delivery_id",id),
      admin.from("receipt_lines").select("invoice_line_id,received_product_name,received_variant,unit,received_qty,damaged_qty,identity_confirmed,condition_confirmed").eq("delivery_id",id),
    ]);
    if(invoices.error||receipts.error||!invoices.data||!receipts.data)
      return NextResponse.json({error:"Unable to read complete receipt."},{status:503});
    const result=reconcile(toStoredDraft(delivery,invoices.data,receipts.data));
    if(result.result==="NEEDS_REVIEW") return NextResponse.json({
      error:"Complete the missing checks first.",unresolved:result.unresolved,
    },{status:409});
    // Only the database version-checked transaction can persist final status.
    const {data,error}=await admin.rpc("kp_confirm_delivery",{
      p_owner:auth.user.id,p_delivery:id,p_expected_version:body.expectedVersion,
      p_findings:result,
    });
    if(error) {
      if(error.code==="40001"||error.message.includes("changed"))
        return NextResponse.json({error:"Delivery changed; refresh first."},{status:409});
      console.error("Confirm RPC failed",error.code);
      return NextResponse.json({error:"Could not confirm delivery."},{status:409});
    }
    return NextResponse.json({id:data.id,status:data.status,version:data.version,result});
  } catch(error) {
    if(error instanceof RequestBodyError)
      return NextResponse.json({error:error.message},{status:error.status});
    if(error instanceof z.ZodError||error instanceof SyntaxError)
      return NextResponse.json({error:"Invalid confirmation request."},{status:400});
    console.error("Confirm route unavailable",error instanceof Error?error.name:"Unknown");
    return NextResponse.json({error:"Confirmation unavailable."},{status:503});
  }
}
