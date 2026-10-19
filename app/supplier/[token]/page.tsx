import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Boxes, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashSupplierToken, isSupplierToken } from "@/lib/claims/token-core";
import { SupplierReplyForm } from "@/components/claims/supplier-reply-form";

export const dynamic="force-dynamic";
export const metadata:Metadata={
  title:"Supplier discrepancy response | KiranaProof",
  robots:{index:false,follow:false,noarchive:true,nosnippet:true},
  referrer:"no-referrer",
};
interface SupplierClaim {
  claimId:string;supplierName:string;referenceNumber:string;
  items:{issueType:string;productName:string;unit:string;affectedQuantity:number|null;detail:string;retailerNote:string}[];
}

export default async function SupplierClaimPage({params}:{params:Promise<{token:string}>}) {
  const {token}=await params;
  if(!isSupplierToken(token)) notFound();
  const admin=createAdminClient();
  const {data,error}=await admin.rpc("kp_get_supplier_claim",{p_hash:hashSupplierToken(token)});
  if(error || !data) notFound();
  const claim=data as SupplierClaim;
  return <div className="min-h-screen bg-[#f7f7f2]">
    <header className="border-b border-[#e5ebe7] bg-white">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-5 text-xl font-extrabold">
        <span className="brand-mark"><Boxes size={20}/></span>Kirana<span className="text-[#d46b2b]">Proof</span>
      </div>
    </header>
    <main className="mx-auto max-w-3xl space-y-6 px-5 py-10">
      <div><p className="kicker">Private supplier discrepancy link</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em]">Delivery discrepancy</h1>
        <p className="mt-2 text-sm text-[#6d7d85]">For {claim.supplierName} · Invoice/order {claim.referenceNumber}</p>
      </div>
      <section className="surface rounded-[22px] p-5 sm:p-7">
        <h2 className="text-lg font-extrabold">Affected goods only</h2>
        <div className="mt-4 space-y-3">{claim.items.map((item,i)=>
          <div key={i} className="rounded-xl border border-[#eee0d2] bg-[#fffaf5] p-4">
            <span className="text-[11px] font-extrabold text-[#b46b3d]">{item.issueType.replaceAll("_"," ")}</span>
            <div className="mt-1 font-bold">{item.productName}</div>
            <p className="mt-1 text-xs text-[#77838a]">{item.detail}</p>
            {item.retailerNote && <p className="mt-2 text-sm text-[#456f54]">Retailer note: {item.retailerNote}</p>}
            <p className="mt-2 text-sm font-semibold">{item.affectedQuantity??"See details"} {item.unit} affected</p>
          </div>
        )}</div>
      </section>
      <SupplierReplyForm token={token}/>
      <p className="flex items-start gap-2 text-xs leading-5 text-[#788790]">
        <ShieldCheck size={16} className="shrink-0"/> Your response is recorded against this specific claim. The retailer confirms any final settlement.
      </p>
    </main>
  </div>;
}
