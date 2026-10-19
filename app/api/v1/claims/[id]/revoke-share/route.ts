import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkWriteRequest } from "@/lib/deliveries/write-guards";

export const runtime="nodejs";

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const guard=checkWriteRequest(request);
  if(guard) return NextResponse.json({error:guard.error},{status:guard.status});
  const {id}=await params;
  if(!z.uuid().safeParse(id).success) return NextResponse.json({error:"Invalid claim identifier."},{status:400});
  try {
    const client=await createServerSupabaseClient();
    const {data:auth,error:authError}=await client.auth.getUser();
    if(authError||!auth.user) return NextResponse.json({error:"Authentication required."},{status:401});
    const body=z.object({confirmRevoke:z.literal(true)}).strict().safeParse(await request.json());
    if(!body.success) return NextResponse.json({error:"Confirm link revocation."},{status:400});
    const admin=createAdminClient();
    const {data,error}=await admin.rpc("kp_revoke_supplier_link",{
      p_owner:auth.user.id,p_claim:id,
    });
    if(error) {
      if(error.code==="42501") return NextResponse.json({error:"Claim not found."},{status:404});
      console.error("Supplier link revocation failed",error.code);
      return NextResponse.json({error:"Unable to revoke link."},{status:503});
    }
    return NextResponse.json({revoked:data.revoked},{headers:{"Cache-Control":"no-store"}});
  }catch(e) {
    if(e instanceof SyntaxError) return NextResponse.json({error:"Invalid JSON."},{status:400});
    console.error("Link revocation unavailable",e instanceof Error?e.name:"Unknown");
    return NextResponse.json({error:"Revocation unavailable."},{status:503});
  }
}
