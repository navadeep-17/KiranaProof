import { NextRequest, NextResponse } from "next/server";
import { checkWriteRequest } from "@/lib/deliveries/write-guards";
import { readBoundedJson,RequestBodyError } from "@/lib/http/bounded-body";
import { ZodError, z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateDeliverySchema, evaluateSubmission, toDatabasePayload } from "@/lib/deliveries/schema";

export const runtime="nodejs";

export async function PUT(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const guard = checkWriteRequest(request);
  if (guard) return NextResponse.json({error:guard.error},{status:guard.status});
  const {id}=await params;
  if(!z.uuid().safeParse(id).success) return NextResponse.json({error:"Invalid delivery id."},{status:400});
  try {
    const user=await createServerSupabaseClient();
    const {data:auth,error:authError}=await user.auth.getUser();
    if(authError||!auth.user) return NextResponse.json({error:"Authentication required."},{status:401});
    const input=updateDeliverySchema.parse(await readBoundedJson(request));
    evaluateSubmission(input);
    const admin=createAdminClient();
    // Check owner and status before invoking the atomic DB function.
    const {data:store,error:storeError}=await admin.from("stores")
      .select("id").eq("owner_user_id",auth.user.id).maybeSingle();
    if(storeError||!store) return NextResponse.json({error:"Store not found."},{status:404});
    const {data:existing,error:readError}=await admin.from("deliveries")
      .select("id,status,version").eq("id",id).eq("store_id",store.id).maybeSingle();
    if(readError||!existing) return NextResponse.json({error:"Delivery not found."},{status:404});
    if(existing.version!==input.expectedVersion) return NextResponse.json({error:"Draft changed. Reload before editing."},{status:409});
    if(!["DRAFT","NEEDS_REVIEW"].includes(existing.status))
      return NextResponse.json({error:"Confirmed deliveries cannot be edited."},{status:409});
    // Ownership and expected version are rechecked under a row lock in the RPC.
    const {data,error}=await admin.rpc("kp_update_delivery",{
      p_owner:auth.user.id,p_delivery:id,p_expected_version:input.expectedVersion,
      p_payload:toDatabasePayload(input),
    });
    if(error) {
      if(error.code==="40001"||error.message.includes("changed"))
        return NextResponse.json({error:"Draft changed. Reload before editing."},{status:409});
      if(error.code==="42501") return NextResponse.json({error:"Delivery not found."},{status:404});
      if(error.code==="23514") return NextResponse.json({error:"Confirmed deliveries cannot be edited."},{status:409});
      console.error("Draft update failed",error.code);
      return NextResponse.json({error:"Unable to update draft."},{status:500});
    }
    return NextResponse.json({id:data.id,status:data.status,version:data.version});
  } catch(error) {
    if(error instanceof RequestBodyError)
      return NextResponse.json({error:error.message},{status:error.status});
    if(error instanceof ZodError || error instanceof SyntaxError)
      return NextResponse.json({error:"Invalid draft fields."},{status:400});
    console.error("Draft update unavailable",error instanceof Error?error.name:"Unknown");
    return NextResponse.json({error:"Draft service unavailable."},{status:503});
  }
}
