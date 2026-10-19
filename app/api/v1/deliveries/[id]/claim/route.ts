import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkWriteRequest } from "@/lib/deliveries/write-guards";
import { approveClaimSchema } from "@/lib/claims/schema";

export const runtime = "nodejs";

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const guard=checkWriteRequest(request);
  if(guard) return NextResponse.json({error:guard.error},{status:guard.status});
  const {id}=await params;
  if(!z.uuid().safeParse(id).success) return NextResponse.json({error:"Invalid delivery identifier."},{status:400});
  try {
    const client=await createServerSupabaseClient();
    const {data:auth,error:authError}=await client.auth.getUser();
    if(authError||!auth.user) return NextResponse.json({error:"Sign in to approve a claim."},{status:401});
    const input=approveClaimSchema.safeParse(await request.json());
    if(!input.success) return NextResponse.json({error:"Review and explicitly approve the discrepancy before creating a claim."},{status:400});
    const admin=createAdminClient();
    const {data,error}=await admin.rpc("kp_approve_reviewed_claim",{
      p_owner:auth.user.id,p_delivery:id,p_expected_version:input.data.expectedVersion,
      p_selection:input.data.reviewedItems,
    });
    if(error) {
      if(error.code==="42501") return NextResponse.json({error:"Delivery not found."},{status:404});
      if(error.code==="23514"||error.code==="40001") return NextResponse.json({error:"The delivery must have a fully confirmed discrepancy. Refresh and try again."},{status:409});
      console.error("Claim approval failed",error.code);
      return NextResponse.json({error:"Unable to approve claim."},{status:503});
    }
    return NextResponse.json({claimId:data.claimId,replayed:data.replayed},{status:data.replayed?200:201,headers:{"Cache-Control":"no-store"}});
  }catch(error) {
    if(error instanceof SyntaxError) return NextResponse.json({error:"Invalid JSON."},{status:400});
    console.error("Claim approval unavailable",error instanceof Error?error.name:"Unknown");
    return NextResponse.json({error:"Claim approval unavailable."},{status:503});
  }
}
