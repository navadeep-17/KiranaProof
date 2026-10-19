import test from "node:test";
import assert from "node:assert/strict";
import { transcribePrisma,PrismaError,PRISMA_REST_URL } from "../lib/voice/prisma.ts";
import { pcm16ToWav,getWavDuration } from "../lib/voice/wav.ts";
function wav(){const a=pcm16ToWav(new Float32Array(16000));return new File([Uint8Array.from(a).buffer],"test.wav",{type:"audio/wav"});}
test("WAV encoding roundtrips duration and rejects malformed/wrong rate",()=>{
  const b=pcm16ToWav(new Float32Array(32000));
  assert.equal(getWavDuration(b),2);
  const copy=Uint8Array.from(b);copy[24]=0;
  assert.equal(getWavDuration(copy),null);
  assert.equal(getWavDuration(new Uint8Array(20)),null);
});
test("Prisma request uses official multipart contract and header, not query-string key",async()=>{
 const fetcher:typeof fetch=async(url,options)=>{
   assert.equal(url,PRISMA_REST_URL);
   assert.equal(options?.method,"POST");
   assert.equal((options?.headers as Record<string,string>)["X-API-Key-ID"],"test-secret");
   const form=options?.body as FormData;
   assert.ok(form.get("audio_file") instanceof File);
   assert.equal(form.get("language_code"),"te-IN");
   assert.equal(form.get("format"),"transcribe");
   assert.equal(form.get("itn_native_numerals"),"false");
   return Response.json({success:true,request_id:"req1",transcript:"Parle-G 2 cartons missing"});
 };
 const result=await transcribePrisma({audio:wav(),language:"te-IN",apiKey:"test-secret",fetcher});
 assert.deepEqual(result,{transcript:"Parle-G 2 cartons missing",requestId:"req1"});
});
test("missing credentials fail closed and no mock is described as live speech",async()=>{
 await assert.rejects(transcribePrisma({audio:wav(),language:"en-IN",apiKey:""}),PrismaError);
});
test("provider throttling, bad JSON and empty transcript fail closed",async()=>{
 const bad:typeof fetch=async()=>new Response("",{status:429});
 await assert.rejects(transcribePrisma({audio:wav(),language:"en-IN",apiKey:"x",fetcher:bad}),{status:429});
 const invalid:typeof fetch=async()=>Response.json({success:true,transcript:""});
 await assert.rejects(transcribePrisma({audio:wav(),language:"en-IN",apiKey:"x",fetcher:invalid}),PrismaError);
});
