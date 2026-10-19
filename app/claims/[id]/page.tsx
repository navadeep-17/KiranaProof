import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Boxes, ClipboardCheck, MessageCircle, ShieldCheck } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ClaimManagementActions } from "@/components/claims/claim-actions";

export const dynamic="force-dynamic";
export default async function ClaimDetail({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const db=await createServerSupabaseClient();
  const {data:auth,error:authError}=await db.auth.getUser();
  if(authError||!auth.user) redirect("/login");
  const {data:claim,error:claimError}=await db.from("claims")
    .select("id,store_id,delivery_id,status,approved_at,resolved_at,resolution_type,resolution_note")
    .eq("id",id).maybeSingle();
  if(claimError||!claim) notFound();
  const [delivery,items,replies,events]=await Promise.all([
    db.from("deliveries").select("reference_number").eq("id",claim.delivery_id).single(),
    db.from("claim_items").select("id,issue_type,product_name,unit,affected_qty,detail,retailer_note").eq("claim_id",id),
    db.from("supplier_responses").select("response_type,note,responded_at").eq("claim_id",id).maybeSingle(),
    db.from("audit_events").select("id,event_type,created_at,actor_type").eq("delivery_id",claim.delivery_id)
      .order("created_at",{ascending:false}).limit(30),
  ]);
  if(delivery.error||items.error||replies.error||events.error||!delivery.data||!items.data)
    throw new Error("Unable to retrieve the claim.");
  return <div className="min-h-screen bg-[#f7f7f2]">
    <header className="border-b border-[#e5eae7] bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-4 text-xl font-extrabold">
        <span className="brand-mark"><Boxes size={20}/></span>Kirana<span className="text-[#d46b2b]">Proof</span>
      </div>
    </header>
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Link href={`/deliveries/${claim.delivery_id}`} className="inline-flex items-center gap-2 text-sm font-bold text-[#637c72]">
        <ArrowLeft size={16}/> Back to delivery
      </Link>
      <p className="kicker mt-9">Retailer-approved claim</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-[-.04em]">Invoice {delivery.data.reference_number}</h1>
        <span className="rounded-full bg-[#f0ede8] px-4 py-2 text-xs font-extrabold text-[#745e45]">{claim.status.replaceAll("_"," ")}</span>
      </div>
      <p className="mt-2 text-sm text-[#74848a]">Approved {new Date(claim.approved_at).toLocaleString()} · No automatic supplier messages</p>
      <section className="surface mt-7 rounded-[22px] p-5 sm:p-7">
        <h2 className="flex items-center gap-2 text-xl font-extrabold"><ClipboardCheck size={20}/> Claim items ({items.data.length})</h2>
        <div className="mt-5 space-y-3">{items.data.map(item=>
          <div className="rounded-xl border border-[#eee0d3] p-4" key={item.id}>
            <span className="text-xs font-bold text-[#a86c40]">{item.issue_type.replaceAll("_"," ")}</span>
            <p className="mt-1 font-extrabold">{item.product_name}</p>
            <p className="mt-1 text-xs text-[#7c8790]">{item.detail}</p>
            {item.retailer_note && <p className="mt-2 text-sm text-[#557467]">
              Retailer note: {item.retailer_note}
            </p>}
            <p className="mt-2 text-sm font-semibold">{item.affected_qty??"Unspecified"} {item.unit} affected</p>
          </div>
        )}</div>
      </section>
      {replies.data && <section className="surface mt-5 rounded-[22px] p-5 sm:p-7">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><MessageCircle size={20}/> Supplier response</h2>
        <p className="mt-4 text-sm font-extrabold">{replies.data.response_type.replaceAll("_"," ")}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#536b75]">{replies.data.note||"No additional note."}</p>
        <p className="mt-3 text-xs text-[#9aa3a3]">{new Date(replies.data.responded_at).toLocaleString()}</p>
      </section>}
      {claim.status==="RESOLVED" && <section className="mt-5 rounded-2xl border border-[#cce8d3] bg-[#f0faf2] p-5">
        <p className="flex items-center gap-2 font-extrabold text-[#275f42]"><ShieldCheck size={19}/> Resolved by retailer</p>
        <p className="mt-2 text-sm">{claim.resolution_type?.replaceAll("_"," ")} · {claim.resolution_note}</p>
      </section>}
      <ClaimManagementActions claimId={claim.id} status={claim.status}/>
      <section className="surface mt-6 rounded-[22px] p-5 sm:p-7">
        <h2 className="text-lg font-extrabold">Delivery and claim timeline</h2>
        <div className="mt-4 divide-y divide-[#edf0ed]">{(events.data??[]).map(event=>
          <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <div><strong>{event.event_type.replaceAll("_"," ")}</strong>
              <p className="mt-1 text-xs text-[#89959a]">{event.actor_type.toLowerCase()}</p></div>
            <time className="text-xs text-[#84918a]">{new Date(event.created_at).toLocaleString()}</time>
          </div>
        )}</div>
      </section>
    </main>
  </div>;
}
