import test from "node:test";
import assert from "node:assert/strict";
import { extractVoiceException } from "../lib/voice/exceptions.ts";
import type { InvoiceEntry } from "../lib/reconciliation/form.ts";

/** Synthetic labeled parser fixtures, NOT recordings or Gnani model accuracy. */
const invoice:InvoiceEntry[]=[
  {id:"b",productName:"Parle-G",variant:"Carton of 24",unit:"carton",expected:"12"},
  {id:"s",productName:"Lux Soap",variant:"Box",unit:"box",expected:"8"},
];
const fixtures: Array<[string,"SHORTAGE"|"DAMAGE"|"CLARIFY"]>=[
  [
    "Parle G 2 cartons missing",
    "SHORTAGE"
  ],
  [
    "Parle G two cartons short",
    "SHORTAGE"
  ],
  [
    "Parle G ౨ కార్టన్లు తక్కువ",
    "SHORTAGE"
  ],
  [
    "Parle G రెండు కార్టన్లు రాలేదు",
    "SHORTAGE"
  ],
  [
    "Lux Soap 1 box missing",
    "SHORTAGE"
  ],
  [
    "Lux Soap one box short",
    "SHORTAGE"
  ],
  [
    "Lux Soap ౧ బాక్సులు తక్కువ",
    "SHORTAGE"
  ],
  [
    "Lux Soap ఒకటి బాక్స్ రాలేదు",
    "SHORTAGE"
  ],
  [
    "Parle G 3 cartons not received",
    "SHORTAGE"
  ],
  [
    "Lux Soap 2 boxes less",
    "SHORTAGE"
  ],
  [
    "Parle G 1 carton damaged",
    "DAMAGE"
  ],
  [
    "Parle G one carton broken",
    "DAMAGE"
  ],
  [
    "Parle G ౧ కార్టన్లు డ్యామేజ్",
    "DAMAGE"
  ],
  [
    "Parle G ఒకటి కార్టన్ పాడైంది",
    "DAMAGE"
  ],
  [
    "Lux Soap 2 boxes damaged",
    "DAMAGE"
  ],
  [
    "Lux Soap two boxes broken",
    "DAMAGE"
  ],
  [
    "Lux Soap ౨ బాక్సులు దెబ్బతిన్నాయి",
    "DAMAGE"
  ],
  [
    "Lux Soap రెండు బాక్స్ డ్యామేజ్",
    "DAMAGE"
  ],
  [
    "Parle G 2 cartons damaged",
    "DAMAGE"
  ],
  [
    "Lux Soap 3 boxes spoilt",
    "DAMAGE"
  ],
  [
    "2 cartons missing",
    "CLARIFY"
  ],
  [
    "Parle G 2 missing",
    "CLARIFY"
  ],
  [
    "Parle G 1 carton missing and damaged",
    "CLARIFY"
  ],
  [
    "Parle G 2 and 3 cartons missing",
    "CLARIFY"
  ],
  [
    "Parle G 15 cartons missing",
    "CLARIFY"
  ],
  [
    "Lux Soap 9 boxes missing",
    "CLARIFY"
  ],
  [
    "Parle G 2 packets missing",
    "CLARIFY"
  ],
  [
    "Parle G 0 cartons missing",
    "CLARIFY"
  ],
  [
    "Parle G cartons missing",
    "CLARIFY"
  ],
  [
    "Parle G and Lux Soap 2 cartons missing",
    "CLARIFY"
  ],
  [
    "Parle G 2 cartons wrong variant",
    "CLARIFY"
  ],
  [
    "Lux Soap 2 boxes wrong item",
    "CLARIFY"
  ],
  [
    "Parle G 2 cartons different brand",
    "CLARIFY"
  ],
  [
    "Lux Soap 1 box swapped",
    "CLARIFY"
  ],
  [
    "Extra Chips 3 packs arrived",
    "CLARIFY"
  ],
  [
    "3 extra packs not invoiced",
    "CLARIFY"
  ],
  [
    "Lux Soap 2 boxes additional not invoiced",
    "CLARIFY"
  ],
  [
    "Parle G 1 carton more than billed",
    "CLARIFY"
  ],
  [
    "Wrong product arrived instead of Lux Soap 2 boxes",
    "CLARIFY"
  ],
  [
    "Parle G 2 cartons excess received",
    "CLARIFY"
  ]
];
test("40 synthetic Telugu-English exception utterances fail closed on ambiguous intent",()=>{
 let accepted=0,clarified=0;
 for(const [phrase,expected] of fixtures){
   const result=extractVoiceException(phrase,invoice);
   assert.equal(result.verified,false,phrase);
   if(expected==="CLARIFY"){
     assert.equal(result.suggestions.length,0,phrase);
     assert.ok(result.questions.length>0,phrase);
     clarified++;
   }else{
     assert.equal(result.suggestions.length,1,phrase);
     assert.equal(result.suggestions[0]?.issueType,expected,phrase);
     assert.equal(result.suggestions[0]?.confidence,"requires_confirmation",phrase);
     accepted++;
   }
 }
 assert.equal(fixtures.length,40);
 assert.equal(accepted,20);
 assert.equal(clarified,20);
});
