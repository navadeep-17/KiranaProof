import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkWriteRequest } from "@/lib/deliveries/write-guards";
import { resolveClaimSchema } from "@/lib/claims/schema";

export const runtime="nodejs";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const guard=checkWriteRequest(request);
  if(guard) return NextResponse.json({error:guard.error},{status:guard.status});
  const {id}=await params;
  if(!z.uuid().safeParse(id).success) return NextResponse.json({error:"Invalid claim identifier."},{status:400});
  try {
    const db=await createServerSupabaseClient();
    const {data:auth,error:authError}=await db.auth.getUser();
    if(authError||!auth.user) return NextResponse.json({error:"Sign in to resolve this claim."},{status:401});
    const input=resolveClaimSchema.safeParse(await request.json());
    if(!input.success) return NextResponse.json({error:"Choose a resolution and enter a short explanation."},{status:400});
    const admin=createAdminClient();
    const {data,error}=await admin.rpc("kp_resolve_claim",{
      p_owner:auth.user.id,p_claim:id,p_type:input.data.resolutionType,p_note:input.data.note,
    });
    if(error){
      if(error.code==="42501") return NextResponse.json({error:"Claim not found."},{status:404});
      if(error.code==="23514") return NextResponse.json({error:"Claim already resolved or invalid resolution."},{status:409});
      console.error("Claim resolution failed",error.code);
      return NextResponse.json({error:"Unable to resolve claim."},{status:503});
    }
    return NextResponse.json({claimId:data.claimId,status:data.status},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    if(error instanceof SyntaxError) return NextResponse.json({error:"Invalid JSON."},{status:400});
    console.error("Claim resolution unavailable",error instanceof Error?error.name:"Unknown");
    return NextResponse.json({error:"Unable to resolve claim."},{status:503});
  }
}
