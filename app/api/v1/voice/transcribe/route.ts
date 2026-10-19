import { NextRequest,NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWavDuration } from "@/lib/voice/wav";
import { readBoundedMultipart,RequestBodyError } from "@/lib/http/bounded-body";
import { PrismaError,transcribePrisma } from "@/lib/voice/prisma";

export const runtime="nodejs";
export const maxDuration=30;

function sameOrigin(request:NextRequest) {
 const type=request.headers.get("content-type")??"";
 if(!type.toLowerCase().startsWith("multipart/form-data;"))return false;
 if(request.headers.get("sec-fetch-site")==="cross-site")return false;
 const origin=request.headers.get("origin");
 if(origin){
   try{if(new URL(origin).origin!==new URL(request.url).origin)return false;}
   catch{return false;}
 }
 return true;
}

export async function POST(request:NextRequest) {
 if(!sameOrigin(request))return NextResponse.json({error:"Invalid voice upload request."},{status:403});
 const rawLength=Number(request.headers.get("content-length")??0);
 if(Number.isFinite(rawLength)&&rawLength>900000)return NextResponse.json({error:"Audio clip is too large."},{status:413});
 try{
  const client=await createServerSupabaseClient();
  const {data:auth,error:authError}=await client.auth.getUser();
  if(authError||!auth.user)return NextResponse.json({error:"Sign in before voice transcription."},{status:401});
  if(process.env.GNANI_MODE!=="live"||!process.env.GNANI_API_KEY){
    return NextResponse.json({error:"Live Gnani voice is not configured. Use the editable text entry for now."},{status:503});
  }
  const multipart=await readBoundedMultipart(request,900_000);
  const language=multipart.get("language");
  if(language!=="te-IN"&&language!=="en-IN")return NextResponse.json({error:"Choose Telugu or Indian English."},{status:400});
  const file=multipart.get("audio");
  if(!(file instanceof File)||file.size>850000||file.size<44||file.type!=="audio/wav"){
    return NextResponse.json({error:"Upload a short PCM WAV recording."},{status:400});
  }
  const bytes=new Uint8Array(await file.arrayBuffer());
  const seconds=getWavDuration(bytes);
  if(seconds===null)return NextResponse.json({error:"Audio must be 16 kHz mono PCM WAV, up to 25 seconds."},{status:400});
  const result=await transcribePrisma({
    apiKey:process.env.GNANI_API_KEY,language,
    audio:new File([Uint8Array.from(bytes).buffer],"retailer-voice.wav",{type:"audio/wav"}),
  });
  // Never persist raw audio; only send the retailer the editable transcript.
  return NextResponse.json({transcript:result.transcript,provider:"gnani-prisma",seconds},
   {headers:{"Cache-Control":"no-store, private"}});
 }catch(e){
  if(e instanceof RequestBodyError)return NextResponse.json({error:e.message},{status:e.status});
  if(e instanceof PrismaError)return NextResponse.json({error:e.message},{status:e.status});
  console.error("Voice transcription unavailable",e instanceof Error?e.name:"Unknown");
  return NextResponse.json({error:"Voice service unavailable; type the exception instead."},{status:503});
 }
}
