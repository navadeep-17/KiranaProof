import test from "node:test";
import assert from "node:assert/strict";
import { extractVoiceExceptions } from "../lib/voice/exceptions.ts";
import type { InvoiceEntry } from "../lib/reconciliation/form.ts";
const lines:InvoiceEntry[]=[
  {id:"b",productName:"Parle-G",variant:"Carton",unit:"carton",expected:"12"},
  {id:"s",productName:"Lux Soap",variant:"Box",unit:"box",expected:"8"},
];
test("two independent product exceptions yield separate unverified suggestions",()=>{
  const result=extractVoiceExceptions("Parle G 2 cartons missing and Lux Soap 1 box damaged",lines);
  assert.deepEqual(result.suggestions.map(s=>s.issueType),["SHORTAGE","DAMAGE"]);
  assert.equal(result.suggestions[0]?.suggestedReceived,"10");
  assert.equal(result.suggestions[1]?.suggestedDamaged,"1");
  assert.ok(result.suggestions.every(x=>x.confidence==="requires_confirmation"));
  assert.equal(result.verified,false);
});
test("Telugu/English multiline dictation can propose multiple separate issues",()=>{
  const result=extractVoiceExceptions("Parle G ౨ కార్టన్లు తక్కువ; Lux Soap ౧ బాక్స్ డ్యామేజ్",lines);
  assert.equal(result.suggestions.length,2);
  assert.equal(result.verified,false);
});
test("if any fragment lacks an item or number the entire batch waits for clarification",()=>{
  const r=extractVoiceExceptions("Parle G 2 cartons missing and 1 box damaged",lines);
  assert.equal(r.suggestions.length,0);
  assert.ok(r.questions.some(x=>x.includes("Part 2")));
});
test("repeated issue for same item cannot overwrite by batch guess",()=>{
  const r=extractVoiceExceptions("Parle G 2 cartons missing, Parle G 1 carton missing",lines);
  assert.equal(r.suggestions.length,0);
  assert.ok(r.questions.some(x=>x.includes("mentioned twice")));
});
test("shortage and damage for the same item remain independent unverified proposals",()=>{
  const r=extractVoiceExceptions("Parle G 2 cartons missing; Parle G 1 carton damaged",lines);
  assert.equal(r.suggestions.length,2);
  assert.equal(r.suggestions[0]?.suggestedReceived,"10");
  assert.equal(r.suggestions[1]?.suggestedReceived,null);
});
test("never infer correct arrival of unmentioned products",()=>{
  const r=extractVoiceExceptions("Parle G 2 cartons missing",lines);
  assert.equal(r.suggestions.length,1);
  assert.equal(r.verified,false);
  assert.ok(!r.suggestions.some(x=>x.invoiceLineId==="s"));
});
test("oversized lists, inconsistent issue types, and unsupported wrong items fail closed",()=>{
  const many=Array.from({length:6},()=> "Parle G 1 carton damaged").join(", ");
  assert.equal(extractVoiceExceptions(many,lines).suggestions.length,0);
  assert.equal(extractVoiceExceptions("Parle G 2 cartons missing and damaged",lines).suggestions.length,0);
  assert.equal(extractVoiceExceptions("Parle G 2 cartons wrong variant, Lux Soap 1 box damaged",lines).suggestions.length,0);
});
