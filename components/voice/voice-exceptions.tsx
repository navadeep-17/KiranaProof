"use client";
import { useRef,useState } from "react";
import { Mic,Square,MessageCircleQuestion,ChevronRight,AudioLines } from "lucide-react";
import type { InvoiceEntry } from "@/lib/reconciliation/form";
import { extractVoiceException,type VoiceSuggestion } from "@/lib/voice/exceptions";
import { recordingToWav } from "@/lib/voice/browser-audio";

export function VoiceExceptions({
  invoice,onApply,
}:{
  invoice:InvoiceEntry[];
  onApply:(suggestion:VoiceSuggestion)=>void;
}){
 const [language,setLanguage]=useState<"te-IN"|"en-IN">("te-IN");
 const [transcript,setTranscript]=useState("");
 const [provider,setProvider]=useState<"gnani-prisma"|"typed"|null>(null);
 const [busy,setBusy]=useState(false);
 const [recording,setRecording]=useState(false);
 const [message,setMessage]=useState<string|null>(null);
 const [suggestions,setSuggestions]=useState<ReturnType<typeof extractVoiceException>|null>(null);
 const recorder=useRef<MediaRecorder|null>(null);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);

 async function transcribe(file:File) {
  setBusy(true);setMessage(null);setSuggestions(null);
  try {
   const data=new FormData();data.set("language",language);data.set("audio",file);
   const response=await fetch("/api/v1/voice/transcribe",{method:"POST",body:data});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error??"Voice transcription failed.");
   if(typeof result.transcript!=="string"||result.provider!=="gnani-prisma")
     throw new Error("Unexpected voice provider response.");
   setTranscript(result.transcript);setProvider("gnani-prisma");
   setMessage("Gnani transcript received. Review and correct the text before suggesting changes.");
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to transcribe. Type your exception below.");}
  finally{setBusy(false);}
 }
 async function start(){
  setMessage(null);
  if(typeof MediaRecorder==="undefined"||!navigator.mediaDevices?.getUserMedia){
   setMessage("Microphone recording is unavailable in this browser. Type the exception below.");
   return;
  }
  try {
   const stream=await navigator.mediaDevices.getUserMedia({
    audio:{echoCancellation:true,noiseSuppression:true,channelCount:1},
   });
   const chunks:BlobPart[]=[];
   const capture=new MediaRecorder(stream);
   recorder.current=capture;
   capture.ondataavailable=event=>{if(event.data.size>0)chunks.push(event.data);};
   capture.onstop=async()=>{
     if(timer.current)clearTimeout(timer.current);
     stream.getTracks().forEach(track=>track.stop());
     recorder.current=null;setRecording(false);
     if(chunks.length===0){setMessage("No audio was recorded.");return;}
     try{
       const wav=await recordingToWav(new Blob(chunks));
       await transcribe(wav);
     }catch(e){setMessage(e instanceof Error?e.message:"Unable to process recording.");}
   };
   capture.onerror=()=>{
     stream.getTracks().forEach(track=>track.stop());
     if(timer.current)clearTimeout(timer.current);
     setRecording(false);setMessage("Microphone capture failed. Try manual entry.");
   };
   capture.start();
   timer.current=setTimeout(()=>{if(capture.state==="recording")capture.stop();},20000);
   setRecording(true);
  }catch{
   setMessage("Microphone permission denied or device unavailable. Type the exception instead.");
  }
 }
 function stop(){if(recorder.current?.state==="recording")recorder.current.stop();}
 function analyze(){
   const result=extractVoiceException(transcript,invoice);
   setSuggestions(result);
   if(result.suggestions.length===0)setMessage("More detail is needed before proposing an invoice change.");
   else setMessage("Suggestion only. Check quantity and damage before verifying this receipt line.");
 }
 return <section className="surface mb-5 rounded-[22px] p-5 sm:p-7" aria-labelledby="voice-title">
  <div className="flex items-start gap-3">
   <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eff7ef] text-[#46735f]">
    <AudioLines size={21}/>
   </div>
   <div>
    <p className="kicker">Voice-assisted exceptions</p>
    <h2 id="voice-title" className="mt-1 text-lg font-extrabold">Speak what went wrong</h2>
    <p className="mt-2 text-xs leading-5 text-[#79878b]">
     Optional short Telugu-English voice clips. Only exact, reviewable suggestions appear below.
     The other invoice lines remain unchecked.
    </p>
   </div>
  </div>
  <div className="mt-5 flex flex-wrap items-center gap-3">
   <label className="block min-w-40">
    <span className="field-label">Speech language</span>
    <select className="input" disabled={recording||busy} value={language}
      onChange={e=>setLanguage(e.target.value as "te-IN"|"en-IN")}>
      <option value="te-IN">Telugu (te-IN)</option>
      <option value="en-IN">Indian English (en-IN)</option>
    </select>
   </label>
   {recording?
    <button className="btn btn-outline" type="button" onClick={stop}><Square size={16}/> Stop recording</button>:
    <button className="btn btn-primary" type="button" disabled={busy} onClick={start}>
      <Mic size={16}/>{busy?"Transcribing...":"Record up to 20 seconds"}
    </button>
   }
  </div>
  {recording&&<p role="status" className="mt-3 text-sm font-semibold text-[#bd592e]">
    Recording privately in your browser. Stop when finished; maximum 20 seconds.
  </p>}
  <label className="mt-5 block">
   <span className="field-label">Review or type the exact spoken words</span>
   <textarea className="input min-h-28" value={transcript}
    placeholder="Example: Parle G 2 cartons missing (or Telugu: Parle G ౨ కార్టన్లు తక్కువ)"
    maxLength={2500}
    onChange={e=>{setTranscript(e.target.value);setProvider("typed");setSuggestions(null);}}/>
  </label>
  {provider==="gnani-prisma"&&<p className="mt-2 text-xs font-bold text-[#3b8260]">
    Gnani Prisma transcript — may contain transcription errors; verify every detail
  </p>}
  <button disabled={busy||!transcript.trim()} className="btn btn-outline mt-4" type="button"
    onClick={analyze}><ChevronRight size={16}/> Analyze transcript (no changes yet)</button>
  {message&&<p role="status" className="mt-4 rounded-xl border border-[#dde7df] bg-[#f7faf7] p-3 text-sm text-[#60746b]">{message}</p>}
  {suggestions?.questions.map((q,i)=><div key={i}
    className="mt-3 flex items-start gap-2 rounded-xl border border-[#efdcc0] bg-[#fff9ee] p-3 text-sm text-[#846436]">
      <MessageCircleQuestion size={18} className="shrink-0"/>{q}
    </div>)}
  {suggestions?.suggestions.map((s,i)=><div key={i}
    className="mt-4 rounded-xl border border-[#d3e6d8] bg-[#f3fbf5] p-4">
    <div className="text-xs font-extrabold uppercase tracking-wider text-[#4e7960]">Unverified suggestion</div>
    <div className="mt-1 font-bold">{s.productName} · {s.issueType.toLowerCase()} · {s.affectedQuantity} {s.unit}</div>
    <p className="mt-2 text-sm leading-6 text-[#5e7c6a]">
      {s.suggestedReceived!==null?`Suggested received: ${s.suggestedReceived} ${s.unit} (based on billed quantity)`:
       `Suggested damaged: ${s.suggestedDamaged} ${s.unit}; received count is still unknown`}
    </p>
    <button className="btn btn-primary mt-4" type="button" onClick={()=>{onApply(s);setSuggestions(null);setMessage("Suggested values copied into the receipt. Verify product, received quantity and damage manually.");}}>
      Copy suggestion into receipt — do not verify
    </button>
   </div>)}
  <p className="mt-4 text-[11px] leading-5 text-[#87928c]">
   Audio is sent to Gnani only with a configured server-side API key; it is not saved in KiranaProof.
   Without live credentials, use manual text input. This assistant never approves claims.
  </p>
 </section>;
}
