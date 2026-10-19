import assert from "node:assert/strict";
import test from "node:test";
import { checkWriteRequest } from "../lib/deliveries/write-guards.ts";

const request=(headers:Record<string,string>)=>new Request("http://localhost:3000/api/v1/deliveries", {
  method:"POST",headers,body:"{}",
});
test("same-origin application/json write is accepted",()=>{
  assert.equal(checkWriteRequest(request({"content-type":"application/json","origin":"http://localhost:3000","sec-fetch-site":"same-origin"})),null);
});
test("form and plain-text CSRF attempts are rejected",()=>{
  assert.equal(checkWriteRequest(request({"content-type":"application/x-www-form-urlencoded"}))?.status,415);
  assert.equal(checkWriteRequest(request({"content-type":"text/plain"}))?.status,415);
});
test("cross-origin JSON and spoofed fetch-site are rejected",()=>{
  assert.equal(checkWriteRequest(request({"content-type":"application/json","origin":"https://evil.example"}))?.status,403);
  assert.equal(checkWriteRequest(request({"content-type":"application/json","sec-fetch-site":"cross-site"}))?.status,403);
});
test("malformed origin and oversized request are rejected",()=>{
  assert.equal(checkWriteRequest(request({"content-type":"application/json","origin":"garbage"}))?.status,403);
  assert.equal(checkWriteRequest(request({"content-type":"application/json","content-length":"170000"}))?.status,413);
});
test("valid JSON without Origin remains supported for nonbrowser test clients",()=>{
  assert.equal(checkWriteRequest(request({"content-type":"application/json"})),null);
});
