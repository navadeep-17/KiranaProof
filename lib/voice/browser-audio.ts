"use client";
import { pcm16ToWav } from "./wav";

/** Decode browser-native recorder format, resample to 16kHz mono, encode PCM16 WAV. */
export async function recordingToWav(blob:Blob):Promise<File>{
  const context=new AudioContext();
  try{
    const decoded=await context.decodeAudioData(await blob.arrayBuffer());
    if(decoded.duration>25||decoded.duration<0.3) throw new Error("Keep voice clips between 1 and 20 seconds.");
    const offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000);
    const src=offline.createBufferSource();src.buffer=decoded;src.connect(offline.destination);src.start();
    const audio=await offline.startRendering();
    const bytes=pcm16ToWav(audio.getChannelData(0));
    return new File([Uint8Array.from(bytes).buffer],"voice.wav",{type:"audio/wav"});
  }finally{await context.close();}
}
