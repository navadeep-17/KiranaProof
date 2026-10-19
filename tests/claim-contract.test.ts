import assert from "node:assert/strict";
import test from "node:test";
import { approveClaimSchema, issueShareLinkSchema, supplierResponseSchema, resolveClaimSchema } from "../lib/claims/schema.ts";
import { createSupplierToken,hashSupplierToken,isSupplierToken } from "../lib/claims/token-core.ts";

test("explicit approval is required and version is mandatory",()=>{
  assert.equal(approveClaimSchema.safeParse({approved:true,expectedVersion:2}).success,true);
  for(const item of [{expectedVersion:2},{approved:false,expectedVersion:2},{approved:true,expectedVersion:0},{approved:true,expectedVersion:2,status:"RECONCILED"}]){
    assert.equal(approveClaimSchema.safeParse(item).success,false);
  }
});
test("share expires within seven days and needs deliberate authorization",()=>{
  assert.equal(issueShareLinkSchema.safeParse({confirmShare:true,expiresInDays:7}).success,true);
  assert.equal(issueShareLinkSchema.safeParse({confirmShare:false,expiresInDays:7}).success,false);
  assert.equal(issueShareLinkSchema.safeParse({confirmShare:true,expiresInDays:8}).success,false);
});
test("supplier response is narrowly typed and requires explanatory text when disputing",()=>{
  assert.equal(supplierResponseSchema.safeParse({responseType:"ACKNOWLEDGED",note:""}).success,true);
  assert.equal(supplierResponseSchema.safeParse({responseType:"DISPUTED",note:"Nope"}).success,true);
  assert.equal(supplierResponseSchema.safeParse({responseType:"DISPUTED",note:""}).success,false);
  assert.equal(supplierResponseSchema.safeParse({responseType:"PAID",note:"done"}).success,false);
});
test("retailer alone chooses recorded resolution and provides notes",()=>{
  assert.equal(resolveClaimSchema.safeParse({resolutionType:"CREDITED",note:"Credit received"}).success,true);
  assert.equal(resolveClaimSchema.safeParse({resolutionType:"OTHER",note:""}).success,false);
});
test("supplier links are unguessable, hashed, and format validated",()=>{
  const a=createSupplierToken(),b=createSupplierToken();
  assert.equal(a.length,64);
  assert.notEqual(a,b);
  assert.ok(isSupplierToken(a));
  assert.ok(isSupplierToken(hashSupplierToken(a)));
  assert.notEqual(hashSupplierToken(a),a);
  assert.notEqual(hashSupplierToken(a),hashSupplierToken(b));
  assert.equal(isSupplierToken("../etc/passwd"),false);
  assert.throws(()=>hashSupplierToken("not a token"));
});
