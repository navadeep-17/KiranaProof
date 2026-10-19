/**
 * Bound bytes as they arrive, not only the untrusted Content-Length header.
 * Useful for both JSON and multipart endpoints that may receive chunked uploads.
 */
export class RequestBodyError extends Error {
  readonly status: 400 | 413;
  constructor(message:string,status:400|413) {
    super(message);
    this.name="RequestBodyError";
    this.status=status;
  }
}
export async function readBoundedBody(
  request:Pick<Request,"headers"|"body">,
  maxBytes:number,
):Promise<Uint8Array> {
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1) throw new Error("Invalid body size limit");
  const header=request.headers.get("content-length");
  if(header!==null && /^\d+$/.test(header) && Number(header)>maxBytes) {
    throw new RequestBodyError("Request exceeds the permitted size.",413);
  }
  if(!request.body) throw new RequestBodyError("Request body is required.",400);
  const reader=request.body.getReader();
  const chunks:Uint8Array[]=[];
  let length=0;
  try{
    while(true){
      const {value,done}=await reader.read();
      if(done) break;
      if(!value)continue;
      length+=value.byteLength;
      if(length>maxBytes){
        await reader.cancel().catch(()=>{});
        throw new RequestBodyError("Request exceeds the permitted size.",413);
      }
      chunks.push(value);
    }
  }catch(e){
    if(e instanceof RequestBodyError)throw e;
    throw new RequestBodyError("Unable to read request body.",400);
  }finally{
    reader.releaseLock();
  }
  if(length===0) throw new RequestBodyError("Request body is required.",400);
  const result=new Uint8Array(length);
  let offset=0;
  for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}
  return result;
}
export async function readBoundedJson(
  request:Pick<Request,"headers"|"body">,
  maxBytes=160_000,
):Promise<unknown>{
  const bytes=await readBoundedBody(request,maxBytes);
  try {
    return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
  }catch{
    throw new RequestBodyError("Invalid JSON request body.",400);
  }
}
export async function readBoundedMultipart(
  request:Pick<Request,"headers"|"body">,
  maxBytes:number,
):Promise<FormData>{
  const type=request.headers.get("content-type");
  if(!type || !/^multipart\/form-data\s*;/i.test(type))
    throw new RequestBodyError("Multipart form-data required.",400);
  const bytes=await readBoundedBody(request,maxBytes);
  try{
    const safe=new Request("http://localhost/form",{
      method:"POST",
      headers:{"content-type":type},
      body:Uint8Array.from(bytes).buffer,
    });
    return await safe.formData();
  }catch{
    throw new RequestBodyError("Invalid multipart audio upload.",400);
  }
}
