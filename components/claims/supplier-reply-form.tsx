"use client";
import { useState, type FormEvent } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { supplierCopy, type SupplierUiLanguage } from "@/lib/locale/supplier";

export function SupplierReplyForm({token}:{token:string}) {
  const [language,setLanguage]=useState<SupplierUiLanguage>("en");
  const words=supplierCopy[language];
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
      if(!response.ok) throw new Error(data.error??words.error);
      setDone(true);
    }catch(e){setError(e instanceof Error?e.message:words.error);}
    finally{setBusy(false);}
  }
  if(done) return <div role="status" lang={language} className="rounded-2xl border border-[#cfe5d4] bg-[#f0faf3] p-6">
    <CheckCircle2 size={28} className="text-[#32805b]"/>
    <h2 className="mt-3 text-xl font-extrabold">{words.doneTitle}</h2>
    <p className="mt-2 text-sm text-[#5e796a]">{words.doneDescription}</p>
  </div>;
  return <form onSubmit={submit} className="surface rounded-[22px] p-5 sm:p-7" lang={language}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <span className="text-xs font-semibold text-[#627377]">Language / భాష</span>
      <div className="inline-flex gap-2" role="group" aria-label="Response language">
        <button className="btn btn-outline" type="button" aria-pressed={language==="en"} onClick={()=>setLanguage("en")}>English</button>
        <button className="btn btn-outline" type="button" aria-pressed={language==="te"} onClick={()=>setLanguage("te")}>తెలుగు</button>
      </div>
    </div>
    <h2 className="text-xl font-extrabold">{words.heading}</h2>
    <p className="mt-2 text-sm text-[#687987]">{words.description}</p>
    <label className="mt-5 block"><span className="field-label">{words.responseLabel}</span>
      <select className="input" value={kind} onChange={e=>setKind(e.target.value)}>
        <option value="ACKNOWLEDGED">{words.acknowledge}</option>
        <option value="PROPOSED_RESOLUTION">{words.propose}</option>
        <option value="DISPUTED">{words.dispute}</option>
      </select>
    </label>
    <label className="mt-4 block"><span className="field-label">
      {words.explanation} {kind==="ACKNOWLEDGED"?words.optional:words.required}
      </span><textarea className="input min-h-28" maxLength={1000} value={note}
      placeholder={words.placeholder}
      onChange={e=>setNote(e.target.value)}/></label>
    {error && <p role="alert" className="mt-4 rounded-xl border border-[#eac9b5] bg-[#fff1e9] p-3 text-sm text-[#ad492d]">{error}</p>}
    <button disabled={busy||(kind!=="ACKNOWLEDGED"&&note.trim().length<3)}
      type="submit" className="btn btn-primary mt-5">
      <Send size={16}/>{busy?words.submitting:words.submit}
    </button>
  </form>;
}
