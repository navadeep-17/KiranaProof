"use client";
import { useState, type FormEvent } from "react";
import { CheckCircle2, Send } from "lucide-react";

export function SupplierReplyForm({token}:{token:string}) {
  const [kind,setKind]=useState("ACKNOWLEDGED");
  const [note,setNote]=useState("");
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);
  const [error,setError]=useState<string|null>(null);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy||done) return;
    setBusy(true);setError(null);
    try{
      const response=await fetch(`/api/v1/supplier/${encodeURIComponent(token)}/reply`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({responseType:kind,note}),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error??"Unable to submit response.");
      setDone(true);
    }catch(e){setError(e instanceof Error?e.message:"Unable to submit.");}
    finally{setBusy(false);}
  }
  if(done) return <div role="status" className="rounded-2xl border border-[#cfe5d4] bg-[#f0faf3] p-6">
    <CheckCircle2 size={28} className="text-[#32805b]"/>
    <h2 className="mt-3 text-xl font-extrabold">Response recorded</h2>
    <p className="mt-2 text-sm text-[#5e796a]">The retailer can now review your reply and record a resolution. This link cannot be used to respond again.</p>
  </div>;
  return <form onSubmit={submit} className="surface rounded-[22px] p-5 sm:p-7">
    <h2 className="text-xl font-extrabold">Respond to this discrepancy</h2>
    <p className="mt-2 text-sm text-[#687987]">One response per claim. You cannot change the retailer's recorded delivery or mark a claim resolved.</p>
    <label className="mt-5 block"><span className="field-label">Your response</span>
      <select className="input" value={kind} onChange={e=>setKind(e.target.value)}>
        <option value="ACKNOWLEDGED">Acknowledge receipt</option>
        <option value="PROPOSED_RESOLUTION">Propose a replacement or credit</option>
        <option value="DISPUTED">Dispute these findings</option>
      </select>
    </label>
    <label className="mt-4 block"><span className="field-label">
      Explanation {kind==="ACKNOWLEDGED"?"(optional)":"(required)"}
      </span><textarea className="input min-h-28" maxLength={1000} value={note}
      placeholder="Add details about the products, replacement, or reason for dispute."
      onChange={e=>setNote(e.target.value)}/></label>
    {error && <p role="alert" className="mt-4 rounded-xl border border-[#eac9b5] bg-[#fff1e9] p-3 text-sm text-[#ad492d]">{error}</p>}
    <button disabled={busy||(kind!=="ACKNOWLEDGED"&&note.trim().length<3)}
      type="submit" className="btn btn-primary mt-5">
      <Send size={16}/>{busy?"Submitting...":"Submit supplier response"}
    </button>
  </form>;
}
