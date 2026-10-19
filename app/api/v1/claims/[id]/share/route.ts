import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkWriteRequest } from "@/lib/deliveries/write-guards";
import { readBoundedJson,RequestBodyError } from "@/lib/http/bounded-body";
import { issueShareLinkSchema } from "@/lib/claims/schema";
import { createSupplierToken,hashSupplierToken } from "@/lib/claims/token-core";

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
    const input=issueShareLinkSchema.safeParse(await readBoundedJson(request));
    if(!input.success) return NextResponse.json({error:"Explicitly confirm the link expiry before generating."},{status:400});
    const token=createSupplierToken();
    const tokenHash=hashSupplierToken(token);
    const expiresAt=new Date(Date.now()+input.data.expiresInDays*86400000).toISOString();
    const admin=createAdminClient();
    const {data,error}=await admin.rpc("kp_issue_supplier_link",{
      p_owner:auth.user.id,p_claim:id,p_hash:tokenHash,p_expires_at:expiresAt,
    });
    if(error) {
      if(error.code==="42501") return NextResponse.json({error:"Claim not found."},{status:404});
      if(error.code==="23514") return NextResponse.json({error:"This claim cannot receive another supplier reply."},{status:409});
      console.error("Supplier link failed",error.code);
      return NextResponse.json({error:"Unable to issue a supplier link."},{status:503});
    }
    // Link is returned only once. Regenerating it immediately invalidates the old link.
    const url=new URL("/supplier/"+token,request.url).toString();
    return NextResponse.json({url,expiresAt:data.expiresAt},{
      headers:{"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex"},
    });
  }catch(error) {
    if(error instanceof RequestBodyError)
      return NextResponse.json({error:error.message},{status:error.status});
    if(error instanceof SyntaxError) return NextResponse.json({error:"Invalid JSON."},{status:400});
    console.error("Supplier share unavailable",error instanceof Error?error.name:"Unknown");
    return NextResponse.json({error:"Unable to issue supplier link."},{status:503});
  }
}
