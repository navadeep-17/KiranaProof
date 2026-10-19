/**
 * Gnani Prisma v2.5 REST STT adapter; no audio, transcripts or keys are logged.
 * https://docs.gnani.ai/api/STT/speech-to-text
 * Transport is injectable to test the real multipart contract without an API key.
 */
export const PRISMA_REST_URL = "https://api.vachana.ai/stt/v3";
export type PrismaLanguage = "te-IN" | "en-IN";
export class PrismaError extends Error {
  readonly status:number;
  constructor(message:string,status:number){super(message);this.name="PrismaError";this.status=status;}
}
export async function transcribePrisma(input:{
  audio:File;language:PrismaLanguage;apiKey:string;fetcher?:typeof fetch;
}):Promise<{transcript:string;requestId:string|null}> {
  if(!input.apiKey.trim()) throw new PrismaError("Prisma API key is not configured",503);
  if(!["te-IN","en-IN"].includes(input.language)) throw new PrismaError("Unsupported language",400);
  const form=new FormData();
  form.set("audio_file",input.audio,"retailer-voice.wav");
  form.set("language_code",input.language);
  form.set("preferred_language",input.language);
  form.set("format","transcribe");
  form.set("itn_native_numerals","false"); // Keep quantities in ASCII for review.
  let response:Response;
  try{
    response=await (input.fetcher??fetch)(PRISMA_REST_URL,{
      method:"POST",
      headers:{"X-API-Key-ID":input.apiKey},
      body:form,
      signal:AbortSignal.timeout(20000),
      cache:"no-store",
    });
  }catch{
    throw new PrismaError("Voice provider did not respond. Try again or enter quantities manually.",503);
  }
  if(!response.ok) {
    if(response.status===429) throw new PrismaError("Voice provider is busy. Wait before retrying.",429);
    throw new PrismaError("Voice transcription is unavailable. Use manual entry.",502);
  }
  let payload:unknown;
  try{payload=await response.json();}catch{throw new PrismaError("Invalid voice provider response",502);}
  if(!payload||typeof payload!=="object") throw new PrismaError("Invalid voice provider response",502);
  const data=payload as Record<string,unknown>;
  if(data.success!==true||typeof data.transcript!=="string"||!data.transcript.trim()||data.transcript.length>5000)
    throw new PrismaError("Voice provider returned no usable transcript",502);
  return {transcript:data.transcript.trim(),requestId:typeof data.request_id==="string"?data.request_id:null};
}
