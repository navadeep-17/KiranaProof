import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Boxes, CheckCircle2, ClipboardList, Pencil } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ApproveClaimButton } from "@/components/claims/claim-actions";
export const dynamic="force-dynamic";

export default async function DeliveryDetail({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const db=await createServerSupabaseClient();
  const {data:auth}=await db.auth.getUser();
  if(!auth.user) redirect("/login");
  const {data:delivery}=await db.from("deliveries")
    .select("id,reference_number,baseline_type,delivery_date,status,version,confirmed_at")
    .eq("id",id).maybeSingle();
  if(!delivery) notFound();
  const {data:lines,error:linesError}=await db.from("invoice_lines")
    .select("id,line_no,product_name,variant,unit,expected_qty")
    .eq("delivery_id",id).order("line_no");
  const {data:receipts,error:receiptsError}=await db.from("receipt_lines")
    .select("invoice_line_id,received_product_name,received_variant,unit,received_qty,damaged_qty")
    .eq("delivery_id",id);
  if(linesError||receiptsError) throw new Error("Unable to load this delivery");
  const {data:run,error:runError}=await db.from("reconciliation_runs")
    .select("findings_json,result,run_at")
    .eq("delivery_id",id).order("run_at",{ascending:false}).limit(1).maybeSingle();
  if(runError) throw new Error("Unable to load reconciliation findings.");
  const findings=(run?.findings_json && typeof run.findings_json==="object")
    ? run.findings_json as {discrepancies?:{type:string;productName:string;affectedQuantity:number|null;unit:string;detail:string}[]}
    : null;
  const issues=Array.isArray(findings?.discrepancies)?findings.discrepancies:[];
  const {data:existingClaim,error:claimError}=await db.from("claims")
    .select("id,status").eq("delivery_id",id).maybeSingle();
  if(claimError) throw new Error("Unable to check claim status.");
  const unexpected=(receipts??[]).filter(r=>r.invoice_line_id===null);
  const receiptMap=new Map((receipts??[]).filter(r=>r.invoice_line_id).map(r=>[r.invoice_line_id,r]));
  return <div className="min-h-screen bg-[#f7f7f2]">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-4 font-extrabold">
      <span className="brand-mark"><Boxes size={18}/></span>KiranaProof
    </div></header>
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Link className="text-sm font-semibold text-[#56736b]" href="/dashboard"><ArrowLeft size={16} className="mr-2 inline"/>Dashboard</Link>
      <p className="kicker mt-8">Saved delivery record</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em]">{delivery.reference_number}</h1>
      <p className="mt-2 text-sm text-[#71818b]">{delivery.baseline_type} · {delivery.delivery_date}</p>
      {["DRAFT","NEEDS_REVIEW"].includes(delivery.status) && (
        <Link href={`/deliveries/${delivery.id}/edit`} className="btn btn-primary mt-5">
          <Pencil size={16}/> Resume and finish verification
        </Link>
      )}
      <div className={"mt-7 rounded-[20px] border p-6 "+(delivery.status==="RECONCILED"?"border-[#cee7d5] bg-[#f1faf3]":delivery.status==="HAS_DISCREPANCY"?"border-[#eedaca] bg-[#fff6ef]":"border-[#e8dfcc] bg-[#fffaf1]")}>
        <h2 className="flex items-center gap-2 text-xl font-extrabold">
          <CheckCircle2 size={21}/>{delivery.status==="RECONCILED"?"Reconciled — no claim created":delivery.status==="HAS_DISCREPANCY"?"Discrepancy confirmed":"Draft — still needs review"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#63777d]">
          {delivery.status==="RECONCILED"?"All invoice lines matched and were confirmed. No supplier action is required.":
            delivery.status==="HAS_DISCREPANCY"?"Differences are stored. A supplier claim requires your separate, explicit approval.":
            "This draft has not been confirmed. Resume verification to correct missing information and save again."}
        </p>
      </div>
      {issues.length>0 && (
        <section className="surface mt-6 rounded-[20px] p-5 sm:p-7">
          <h2 className="text-lg font-extrabold">Confirmed discrepancy findings ({issues.length})</h2>
          <div className="mt-4 space-y-3">{issues.map((finding,index)=>(
            <div key={index} className="rounded-xl border border-[#f0dfcc] bg-[#fffaf4] p-4">
              <div className="text-xs font-bold text-[#b16b3d]">{finding.type.replaceAll("_"," ")}</div>
              <div className="mt-1 font-bold">{finding.productName}</div>
              <p className="mt-1 text-xs text-[#777f82]">{finding.detail}</p>
              <p className="mt-2 text-sm font-bold">{finding.affectedQuantity??"Unspecified"} {finding.unit} affected</p>
            </div>
          ))}</div>
        </section>
      )}
      {unexpected.length>0 && <section className="surface mt-6 rounded-[20px] p-5 sm:p-7">
        <h2 className="text-lg font-bold">Goods not listed on the invoice</h2>
        <div className="mt-4 space-y-2">{unexpected.map((r,index)=>(
          <div key={index} className="rounded-xl border p-3 text-sm">
            <strong>{r.received_product_name}</strong> · {r.received_qty??"Unknown"} {r.unit} received, {r.damaged_qty??"Unknown"} damaged
          </div>
        ))}</div>
      </section>}
      {delivery.status==="HAS_DISCREPANCY" && (
        existingClaim ? (
          <Link href={`/claims/${existingClaim.id}`} className="btn btn-primary mt-6">
            View approved claim ({existingClaim.status.replaceAll("_"," ")})
          </Link>
        ) : (
          <ApproveClaimButton deliveryId={delivery.id} version={delivery.version}/>
        )
      )}
      <section className="surface mt-6 rounded-[20px] p-5 sm:p-7">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><ClipboardList size={20}/> Invoice comparison</h2>
        <div className="mt-5 space-y-3">{(lines??[]).map(line=>{
          const receipt=receiptMap.get(line.id);
          const differs=receipt && (
            Number(receipt.received_qty)!==Number(line.expected_qty) ||
            Number(receipt.damaged_qty)!==0 ||
            receipt.received_product_name.trim().toLowerCase()!==line.product_name.trim().toLowerCase() ||
            receipt.received_variant.trim().toLowerCase()!==line.variant.trim().toLowerCase() ||
            receipt.unit!==line.unit
          );
          return <div key={line.id} className="flex flex-wrap justify-between gap-4 rounded-xl border border-[#e6ece8] p-4">
            <div><div className="font-bold">{line.product_name}</div><p className="mt-1 text-xs text-[#80908e]">{line.variant} · Billed {line.expected_qty} {line.unit}</p></div>
            <div className="text-right text-sm"><div className={"font-bold "+(differs?"text-[#ae673a]":"text-[#2d704e]")}>{receipt?.received_qty??"Unknown"} {receipt?.unit??line.unit} received</div>
              <p className="mt-1 text-xs text-[#899692]">{receipt?.damaged_qty??"Unknown"} damaged</p></div>
          </div>;
        })}</div>
      </section>
    </main>
  </div>;
}
