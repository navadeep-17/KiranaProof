import { NextRequest, NextResponse } from "next/server";
import { checkWriteRequest } from "@/lib/deliveries/write-guards";
import { RequestBodyError,readBoundedJson } from "@/lib/http/bounded-body";
import { createAdminClient } from "@/lib/supabase/admin";
import { supplierResponseSchema } from "@/lib/claims/schema";
import { isSupplierToken,hashSupplierToken } from "@/lib/claims/token-core";

export const runtime="nodejs";
export async function POST(request:NextRequest,{params}:{params:Promise<{token:string}>}) {
  const guard=checkWriteRequest(request);
  if(guard) return NextResponse.json({error:guard.error},{status:guard.status});
  const {token}=await params;
  if(!isSupplierToken(token)) return NextResponse.json({error:"Invalid or expired supplier link."},{status:404});
  try {
    const input=supplierResponseSchema.safeParse(await readBoundedJson(request,5000));
    if(!input.success) return NextResponse.json({error:"Choose a valid response and add an explanation when needed."},{status:400});
    const admin=createAdminClient();
    const {data,error}=await admin.rpc("kp_supplier_respond",{
      p_hash:hashSupplierToken(token),p_type:input.data.responseType,p_note:input.data.note,
    });
    if(error) {
      if(error.code==="42501"||error.code==="23514"||error.code==="23505")
        return NextResponse.json({error:"This link has expired or a response has already been submitted."},{status:410});
      console.error("Supplier response failed",error.code);
      return NextResponse.json({error:"Unable to record response."},{status:503});
    }
    return NextResponse.json({responseId:data.responseId,status:data.status},{
      headers:{"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer"},
    });
  }catch(error) {
    if(error instanceof RequestBodyError)
      return NextResponse.json({error:error.message},{status:error.status});
    console.error("Supplier reply unavailable",error instanceof Error?error.name:"Unknown");
    return NextResponse.json({error:"Supplier response unavailable."},{status:503});
  }
}
