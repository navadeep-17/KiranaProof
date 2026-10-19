import test from "node:test";
import assert from "node:assert/strict";
import { RequestBodyError,readBoundedBody,readBoundedJson,readBoundedMultipart } from "../lib/http/bounded-body.ts";

function request(content:string,headers:Record<string,string>={}){
  return new Request("http://localhost/upload",{method:"POST",body:content,headers});
}
test("small JSON parses with correct UTF-8 and no Content-Length header",async()=>{
 const value=await readBoundedJson(request('{"message":"తెలుగు text","count":2}'),100);
 assert.deepEqual(value,{message:"తెలుగు text",count:2});
});
test("large chunked JSON body is rejected even with no size header",async()=>{
 const q=request(JSON.stringify({data:"x".repeat(3000)}));
 await assert.rejects(readBoundedJson(q,1000),(e:unknown)=>
   e instanceof RequestBodyError&&e.status===413);
});
test("server does not trust a small Content-Length to override measured size",async()=>{
 const stream=new ReadableStream<Uint8Array>({
  start(controller){controller.enqueue(new TextEncoder().encode("a".repeat(120)));controller.close();}
 });
 const custom={headers:new Headers({"content-length":"2"}),body:stream};
 await assert.rejects(readBoundedBody(custom,100),(e:unknown)=>
   e instanceof RequestBodyError&&e.status===413);
});
test("announced oversize body is rejected without consuming it",async()=>{
 const custom={headers:new Headers({"content-length":"10000"}),body:new ReadableStream<Uint8Array>()};
 await assert.rejects(readBoundedBody(custom,100),(e:unknown)=>
   e instanceof RequestBodyError&&e.status===413);
});
test("truncated JSON and empty body get 400, not provider errors",async()=>{
 await assert.rejects(readBoundedJson(request('{"oops":'),100),{status:400});
 const body={headers:new Headers(),body:null};
 await assert.rejects(readBoundedJson(body,100),{status:400});
});
test("multipart parser accepts a small real FormData payload",async()=>{
 const form=new FormData();form.set("language","te-IN");
 form.set("audio",new File(["test"],"test.wav",{type:"audio/wav"}));
 const req=new Request("http://localhost/upload",{method:"POST",body:form});
 const parsed=await readBoundedMultipart(req,10000);
 assert.equal(parsed.get("language"),"te-IN");
 assert.equal((parsed.get("audio") as File).name,"test.wav");
});
test("multipart upload rejects inflated streaming payload even if Content-Length is omitted",async()=>{
 const form=new FormData();form.set("audio",new File(["x".repeat(2000)],"clip.wav"));
 const req=new Request("http://localhost/upload",{method:"POST",body:form});
 await assert.rejects(readBoundedMultipart(req,400),{status:413});
});
