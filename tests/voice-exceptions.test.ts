import test from "node:test";
import assert from "node:assert/strict";
import { extractVoiceException } from "../lib/voice/exceptions.ts";
import type { InvoiceEntry } from "../lib/reconciliation/form.ts";
const invoice:InvoiceEntry[]=[
 {id:"biscuit",productName:"Parle-G",variant:"Carton of 24",unit:"carton",expected:"12"},
 {id:"soap",productName:"Lux Soap",variant:"Box",unit:"box",expected:"8"},
];
test("English shortage proposes received count but never confirms it",()=>{
 const x=extractVoiceException("Parle G 2 cartons missing",invoice);
 assert.equal(x.suggestions[0]?.invoiceLineId,"biscuit");
 assert.equal(x.suggestions[0]?.suggestedReceived,"10");
 assert.equal(x.suggestions[0]?.suggestedDamaged,null);
 assert.equal(x.suggestions[0]?.confidence,"requires_confirmation");
 assert.equal(x.verified,false);
});
test("Telugu and native numeral shortage may be suggested with known invoice unit",()=>{
 const x=extractVoiceException("Parle G ౨ కార్టన్లు తక్కువ",invoice);
 assert.equal(x.suggestions[0]?.suggestedReceived,"10");
 assert.equal(x.verified,false);
});
test("damage never assumes zero shortage or a received quantity",()=>{
 const x=extractVoiceException("Lux Soap 1 box damaged",invoice);
 assert.equal(x.suggestions[0]?.suggestedDamaged,"1");
 assert.equal(x.suggestions[0]?.suggestedReceived,null);
});
test("no match, multiple products or numbers require clarification",()=>{
 for(const s of ["2 cartons missing","Parle G and Lux Soap 2 cartons missing",
  "Parle G 3 and 4 cartons missing"]) {
   const x=extractVoiceException(s,invoice);
   assert.equal(x.suggestions.length,0,s);assert.ok(x.questions.length>0,s);
 }
});
test("unit omission or unreasonably large shortage cannot auto-fill quantity",()=>{
 for(const s of ["Parle G 2 missing","Parle G 15 cartons missing",
   "Parle G 2 packets missing"]){
   const x=extractVoiceException(s,invoice);
   assert.equal(x.suggestions.length,0,s);assert.ok(x.questions.length>0,s);
 }
});
test("ambiguous condition or no issue requires user clarification",()=>{
 for(const s of ["Parle G 2 cartons arrived","Parle G 2 cartons missing and damaged"]){
   assert.equal(extractVoiceException(s,invoice).suggestions.length,0,s);
 }
});
test("unmentioned invoice lines are never marked verified by voice",()=>{
 const x=extractVoiceException("Parle G two cartons missing",invoice);
 assert.equal(x.suggestions.length,1);
 assert.equal(x.verified,false);
 assert.ok(x.suggestions.every(s=>s.confidence==="requires_confirmation"));
});
