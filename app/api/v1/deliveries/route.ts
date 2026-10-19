import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDeliverySchema, evaluateSubmission } from "@/lib/deliveries/schema";

export const runtime="nodejs";

export async function POST(request:NextRequest) {
  try {
    const userClient=await createServerSupabaseClient();
    const {data:auth,error:authError}=await userClient.auth.getUser();
    if(authError||!auth.user) return NextResponse.json({error:"Sign in before saving."},{status:401});
    const raw=await request.text();
    if(raw.length>160000) return NextResponse.json({error:"Delivery payload is too large."},{status:413});
    const parsed=createDeliverySchema.parse(JSON.parse(raw));
    // Actual reconciliation runs on the server. Ignore all browser-provided outcomes.
    evaluateSubmission(parsed);
    const admin=createAdminClient();
    const {data,error}=await admin.rpc("kp_save_delivery",{
      p_owner:auth.user.id,p_request_id:parsed.clientRequestId,
      p_payload:{
        storeName:parsed.storeName,supplierName:parsed.supplierName,
        referenceNumber:parsed.referenceNumber,baselineType:parsed.baselineType,
        invoice:parsed.invoice,receipts:parsed.receipts,unexpected:parsed.unexpected,
        invoiceCompleteConfirmed:parsed.invoiceCompleteConfirmed,
        unexpectedItemsChecked:parsed.unexpectedItemsChecked,
      },
    });
    if(error) {
      console.error("Save RPC failed",error.code);
      return NextResponse.json({error:"Could not save delivery. Please retry."},{status:500});
    }
    // Read current state on idempotent replays. A successful confirm may already
    // have advanced the delivery from version 1 to version 2.
    const {data:current,error:readError}=await admin.from("deliveries")
      .select("version,status").eq("id",data.id).single();
    if(readError||!current) return NextResponse.json({error:"Delivery saved but status unavailable."},{status:503});
    return NextResponse.json({
      id:data.id,version:current.version,status:current.status,replayed:data.replayed,
    },{status:data.replayed?200:201});
  } catch(error) {
    if(error instanceof ZodError) return NextResponse.json({error:"Invalid delivery fields.",details:error.issues.map(x=>x.message)},{status:400});
    if(error instanceof SyntaxError) return NextResponse.json({error:"Invalid JSON."},{status:400});
    if(error instanceof Error && !error.message.includes("configured")) return NextResponse.json({error:error.message},{status:400});
    console.error("Save route unavailable",error instanceof Error?error.name:"Unknown");
    return NextResponse.json({error:"Save service unavailable."},{status:503});
  }
}
