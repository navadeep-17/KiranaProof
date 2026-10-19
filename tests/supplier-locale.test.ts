import assert from "node:assert/strict";
import test from "node:test";
import {supplierCopy} from "../lib/locale/supplier.ts";
test("supplier reply translations have identical non-empty keys",()=>{
  const a=Object.keys(supplierCopy.en).sort(),b=Object.keys(supplierCopy.te).sort();
  assert.deepEqual(a,b);
  for(const [key,text] of Object.entries(supplierCopy.te)){
    assert.ok(text.trim().length>0,key);
    assert.ok(/[\u0C00-\u0C7F]/u.test(text),`Telugu localization missing for ${key}`);
  }
});
test("supplier actions retain their English defaults for earlier clients",()=>{
  assert.equal(supplierCopy.en.doneTitle,"Response recorded");
  assert.ok(supplierCopy.te.description.includes("క్లెయిమ్"));
});
