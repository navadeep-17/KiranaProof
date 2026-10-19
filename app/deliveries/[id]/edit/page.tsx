import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DeliveryWorkbench, type SavedWorkbenchDraft } from "@/components/delivery/delivery-workbench";

export const dynamic="force-dynamic";

export default async function EditDelivery({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const db=await createServerSupabaseClient();
  const {data:auth,error:authError}=await db.auth.getUser();
  if(authError||!auth.user) redirect("/login");

  const {data:delivery,error:deliveryError}=await db.from("deliveries")
    .select("id,store_id,supplier_id,reference_number,baseline_type,status,version,invoice_complete_confirmed,unexpected_items_checked")
    .eq("id",id).maybeSingle();
  if(deliveryError||!delivery || !["DRAFT","NEEDS_REVIEW"].includes(delivery.status)) notFound();
  const [invoices,receipts,store,supplier]=await Promise.all([
    db.from("invoice_lines").select("id,line_no,product_name,variant,unit,expected_qty")
      .eq("delivery_id",id).order("line_no"),
    db.from("receipt_lines").select("id,invoice_line_id,received_product_name,received_variant,unit,received_qty,damaged_qty,identity_confirmed,condition_confirmed")
      .eq("delivery_id",id),
    db.from("stores").select("name").eq("id",delivery.store_id).single(),
    db.from("suppliers").select("name").eq("id",delivery.supplier_id).single(),
  ]);
  if(invoices.error||receipts.error||store.error||supplier.error||!invoices.data||!receipts.data||!store.data||!supplier.data)
    throw new Error("Cannot load the complete delivery draft.");
  const matched=new Map(receipts.data.filter(x=>x.invoice_line_id).map(x=>[x.invoice_line_id,x]));
  const initialDraft:SavedWorkbenchDraft={
    id:delivery.id,version:delivery.version,storeName:store.data.name,
    supplierName:supplier.data.name,referenceNumber:delivery.reference_number,
    baselineType:delivery.baseline_type==="ORDER"?"ORDER":"INVOICE",
    invoice:invoices.data.map(x=>({
      id:x.id,productName:x.product_name,variant:x.variant,unit:x.unit,
      expected:String(x.expected_qty),
    })),
    receipts:invoices.data.map(x=>{
      const r=matched.get(x.id);
      return {
        invoiceLineId:x.id,
        productName:r?.received_product_name??x.product_name,
        variant:r?.received_variant??x.variant,unit:r?.unit??x.unit,
        received:r?.received_qty===null||r?.received_qty===undefined?"":String(r.received_qty),
        damaged:r?.damaged_qty===null||r?.damaged_qty===undefined?"":String(r.damaged_qty),
        verified:Boolean(r?.identity_confirmed&&r?.condition_confirmed),
      };
    }),
    unexpected:receipts.data.filter(x=>!x.invoice_line_id).map(x=>({
      id:x.id,productName:x.received_product_name,variant:x.received_variant,unit:x.unit,
      received:x.received_qty===null?"":String(x.received_qty),
      damaged:x.damaged_qty===null?"":String(x.damaged_qty),
      verified:x.identity_confirmed&&x.condition_confirmed,
    })),
    invoiceCompleteConfirmed:delivery.invoice_complete_confirmed,
    unexpectedItemsChecked:delivery.unexpected_items_checked,
  };
  return <DeliveryWorkbench initialDraft={initialDraft}/>;
}
