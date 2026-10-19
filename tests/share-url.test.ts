import test from "node:test";
import assert from "node:assert/strict";
import { buildSupplierShareUrl } from "../lib/claims/share-url.ts";
const token="a".repeat(64);

test("configured origin defeats spoofed Host when issuing supplier link",()=>{
 const result=buildSupplierShareUrl(token,"https://malicious.invalid/api/v1/share",
   "https://kirana.example",true);
 assert.equal(result,`https://kirana.example/supplier/${token}`);
 assert.ok(!result.includes("malicious"));
});
test("production rejects missing or malformed public app origin",()=>{
 assert.throws(()=>buildSupplierShareUrl(token,"https://attacker.invalid/",undefined,true));
 for(const bad of ["http://insecure.example","https://user:pass@shop.example",
   "https://shop.example/folder","https://shop.example/?q=1","javascript:alert(1)"]){
   assert.throws(()=>buildSupplierShareUrl(token,"https://attacker.invalid/",bad,true),bad);
 }
});
test("localhost works in private development but invalid tokens are rejected",()=>{
 assert.equal(buildSupplierShareUrl(token,"http://localhost:3000/api",undefined,false),
   `http://localhost:3000/supplier/${token}`);
 assert.equal(buildSupplierShareUrl(token,"https://other.test","http://localhost:3000",true),
   `http://localhost:3000/supplier/${token}`);
 assert.throws(()=>buildSupplierShareUrl("1234","http://localhost:3000",undefined,false));
});
