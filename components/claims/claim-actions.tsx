"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCopy, CheckCircle2, Link2, ShieldCheck } from "lucide-react";

export function ApproveClaimButton({deliveryId,version}:{deliveryId:string;version:number}) {
  const router=useRouter();
  const [approved,setApproved]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  async function approve() {
    if(!approved||busy) return;
    setBusy(true);setError(null);
    try {
      const response=await fetch(`/api/v1/deliveries/${deliveryId}/claim`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({approved:true,expectedVersion:version}),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error??"Unable to approve claim.");
      router.push(`/claims/${data.claimId}`);
      router.refresh();
    }catch(e){setError(e instanceof Error?e.message:"Approval failed.");}
    finally{setBusy(false);}
  }
  return <section className="surface mt-6 rounded-[20px] p-5 sm:p-7">
    <p className="kicker">Separate approval required</p>
    <h2 className="mt-2 text-xl font-extrabold">Turn verified differences into a claim</h2>
    <p className="mt-2 text-sm leading-6 text-[#697982]">
      Review the affected items above. Approving creates a record for those differences only.
      It does not contact the supplier or send WhatsApp messages.
    </p>
    <label className="mt-5 flex items-start gap-3 text-sm leading-6">
      <input type="checkbox" className="soft-check mt-1" checked={approved}
        onChange={e=>setApproved(e.target.checked)}/>
      <span>I reviewed the discrepancies and explicitly approve creating this claim.</span>
    </label>
    {error && <p role="alert" className="mt-3 text-sm text-[#ae412e]">{error}</p>}
    <button className="btn btn-primary mt-5" type="button" disabled={!approved||busy} onClick={approve}>
      <ShieldCheck size={16}/>{busy?"Approving...":"Approve discrepancy claim"}
    </button>
  </section>;
}

export function ClaimManagementActions({claimId,status}:{claimId:string;status:string}) {
  const router=useRouter();
  const [linkBusy,setLinkBusy]=useState(false);
  const [linkConsent,setLinkConsent]=useState(false);
  const [days,setDays]=useState(3);
  const [link,setLink]=useState<string|null>(null);
  const [expires,setExpires]=useState<string|null>(null);
  const [copied,setCopied]=useState(false);
  const [resolutionType,setResolutionType]=useState("REPLACED");
  const [note,setNote]=useState("");
  const [resolutionBusy,setResolutionBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  async function generateLink() {
    if(!linkConsent||linkBusy) return;
    setLinkBusy(true);setError(null);setCopied(false);
    try {
      const response=await fetch(`/api/v1/claims/${claimId}/share`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({confirmShare:true,expiresInDays:days}),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error??"Unable to create supplier link.");
      setLink(data.url);setExpires(data.expiresAt);
    }catch(e){setError(e instanceof Error?e.message:"Link generation failed.");}
    finally{setLinkBusy(false);}
  }
  const [revokeBusy,setRevokeBusy]=useState(false);
  const [revokeMessage,setRevokeMessage]=useState<string|null>(null);
  async function revokeLink() {
    if(revokeBusy) return;
    setRevokeBusy(true);setError(null);setRevokeMessage(null);
    try {
      const response=await fetch(`/api/v1/claims/${claimId}/revoke-share`,{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmRevoke:true}),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error??"Unable to revoke supplier link.");
      setLink(null);setExpires(null);setCopied(false);
      setRevokeMessage(data.revoked?"The supplier link is now revoked.":"There was no active link to revoke.");
    }catch(e){setError(e instanceof Error?e.message:"Unable to revoke link.");}
    finally{setRevokeBusy(false);}
  }

  async function copyLink() {
    if(!link) return;
    try {await navigator.clipboard.writeText(link);setCopied(true);}
    catch{setError("Copy unavailable. Select and copy the link below.");}
  }
  async function resolve() {
    if(resolutionBusy||note.trim().length<3) return;
    setResolutionBusy(true);setError(null);
    try {
      const response=await fetch(`/api/v1/claims/${claimId}/resolve`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({resolutionType,note}),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error??"Unable to record resolution.");
      setLink(null);
      router.refresh();
    }catch(e){setError(e instanceof Error?e.message:"Resolution failed.");}
    finally{setResolutionBusy(false);}
  }
  return <div className="mt-6 space-y-5">
    {status==="OPEN" && <section className="surface rounded-[20px] p-5 sm:p-7">
      <p className="kicker">Supplier access</p>
      <h2 className="mt-2 text-lg font-extrabold">Generate a scoped supplier link</h2>
      <p className="mt-2 text-sm leading-6 text-[#687985]">
        Only the claim items and invoice reference are visible through this link.
        Share it yourself with the intended supplier. It is not sent automatically.
        A new link immediately invalidates any previous one.
      </p>
      <label className="mt-4 block max-w-xs">
        <span className="field-label">Link lifetime</span>
        <select className="input" value={days} onChange={e=>setDays(Number(e.target.value))}>
          <option value={1}>1 day</option><option value={3}>3 days</option><option value={7}>7 days</option>
        </select>
      </label>
      <label className="mt-4 flex items-start gap-3 text-sm leading-6">
        <input type="checkbox" className="soft-check mt-1" checked={linkConsent}
          onChange={e=>setLinkConsent(e.target.checked)}/>
        <span>I understand this is a bearer link and I will only share it with the intended supplier.</span>
      </label>
      <button type="button" onClick={generateLink} disabled={!linkConsent||linkBusy}
        className="btn btn-primary mt-4">
        <Link2 size={16}/>{linkBusy?"Generating...":"Generate or rotate link"}
      </button>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" disabled={revokeBusy} onClick={revokeLink} className="btn btn-outline">
          {revokeBusy?"Revoking...":"Revoke current supplier link"}
        </button>
        <span className="text-xs text-[#7c8991]">Revocation works even if you lost the original link.</span>
      </div>
      {revokeMessage && <p role="status" className="mt-3 text-sm text-[#286c48]">{revokeMessage}</p>}
      {link && <div className="mt-5 rounded-xl border border-[#cddfd6] bg-[#f4fbf6] p-4">
        <strong className="text-sm text-[#225943]">One-time link — copy it now</strong>
        <input aria-label="Supplier claim link" readOnly value={link} className="input mt-2"/>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={copyLink} className="btn btn-outline"><ClipboardCopy size={16}/>{copied?"Copied":"Copy link"}</button>
          <span className="text-xs text-[#6d8275]">Expires: {expires?new Date(expires).toLocaleString():""}</span>
        </div>
      </div>}
    </section>}
    {status!=="RESOLVED" && <section className="surface rounded-[20px] p-5 sm:p-7">
      <p className="kicker">Retailer-only action</p>
      <h2 className="mt-2 text-lg font-extrabold">Record final resolution</h2>
      <p className="mt-2 text-sm leading-6 text-[#6a7982]">Confirm the actual outcome yourself. A supplier response never closes a claim automatically.</p>
      <label className="mt-4 block max-w-sm"><span className="field-label">What resolved this?</span>
        <select className="input" value={resolutionType} onChange={e=>setResolutionType(e.target.value)}>
          <option value="REPLACED">Items replaced</option><option value="CREDITED">Credit issued</option><option value="OTHER">Other resolution</option>
        </select>
      </label>
      <label className="mt-4 block"><span className="field-label">Resolution notes (required)</span>
        <textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={1000}
          className="input min-h-24" placeholder="Describe what was actually received, refunded, or agreed."/>
      </label>
      <button disabled={resolutionBusy||note.trim().length<3} onClick={resolve} type="button"
        className="btn btn-primary mt-4"><CheckCircle2 size={16}/>{resolutionBusy?"Saving...":"Record resolution"}</button>
    </section>}
    {error && <p role="alert" className="rounded-xl border border-[#efc9ba] bg-[#fff1ed] p-4 text-sm text-[#a34a34]">{error}</p>}
  </div>;
}
