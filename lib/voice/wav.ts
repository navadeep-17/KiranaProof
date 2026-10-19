/** Validate exact 16 kHz mono PCM16 WAV before sending audio to Prisma. */
export function getWavDuration(bytes:Uint8Array):number|null {
  if(bytes.byteLength<44 || bytes.byteLength>850000) return null; // <= ~26s at 16k mono
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const text=(at:number)=>String.fromCharCode(...bytes.slice(at,at+4));
  if(text(0)!=="RIFF"||text(8)!=="WAVE"||text(12)!=="fmt "||text(36)!=="data")return null;
  if(view.getUint32(16,true)!==16 || view.getUint16(20,true)!==1 ||
      view.getUint16(22,true)!==1 || view.getUint32(24,true)!==16000 ||
      view.getUint32(28,true)!==32000 || view.getUint16(32,true)!==2 ||
      view.getUint16(34,true)!==16)return null;
  const length=view.getUint32(40,true);
  if(length+44!==bytes.length||length%2!==0)return null;
  const seconds=length/32000;
  return seconds>=0.3&&seconds<=25 ? seconds : null;
}
/** Returns a container that Gnani documents as supported, independent of MediaRecorder codecs. */
export function pcm16ToWav(samples:Float32Array):Uint8Array {
  const out=new Uint8Array(44+samples.length*2);
  const v=new DataView(out.buffer);
  const tag=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)v.setUint8(offset+i,value.charCodeAt(i));};
  tag(0,"RIFF");v.setUint32(4,36+samples.length*2,true);tag(8,"WAVE");
  tag(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);
  v.setUint16(22,1,true);v.setUint32(24,16000,true);
  v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);
  tag(36,"data");v.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++){
    const s=Math.max(-1,Math.min(1,samples[i]));
    v.setInt16(44+i*2,Math.round(s*(s<0?32768:32767)),true);
  }
  return out;
}
