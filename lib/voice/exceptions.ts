import type { InvoiceEntry } from "../reconciliation/form.ts";

export type VoiceSuggestion = {
  invoiceLineId:string;
  productName:string;
  issueType:"SHORTAGE"|"DAMAGE";
  affectedQuantity:number;
  unit:string;
  suggestedReceived:string|null;
  suggestedDamaged:string|null;
  /** Heuristic matching only; never a provider probability or a confirmation. */
  confidence:"requires_confirmation";
  sourcePhrase:string;
};
export type ExtractionResult = {
  suggestions:VoiceSuggestion[];
  questions:string[];
  /** Always false: spoken evidence cannot verify other invoice lines. */
  verified:boolean;
};
function normalize(value:string){
  return value.normalize("NFKC").toLowerCase().replace(/[-_]+/g," ")
    .replace(/[^\p{L}\p{N}.\s]+/gu," ").replace(/\s+/g," ").trim();
}
function numbers(value:string){
 const telugu="౦౧౨౩౪౫౬౭౮౯";
 const mapped=Array.from(value,character=>{
   const i=telugu.indexOf(character);return i>=0?String(i):character;
 }).join("");
 const words:Record<string,string>={
   "one":"1","two":"2","three":"3","four":"4","five":"5",
   "six":"6","seven":"7","eight":"8","nine":"9","ten":"10",
   "ఒకటి":"1","రెండు":"2","మూడు":"3","నాలుగు":"4","ఐదు":"5",
   "ఆరు":"6","ఏడు":"7","ఎనిమిది":"8","తొమ్మిది":"9","పది":"10",
 };
 const replaced=mapped.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b|ఒకటి|రెండు|మూడు|నాలుగు|ఐదు|ఆరు|ఏడు|ఎనిమిది|తొమ్మిది|పది/giu,
   found=>words[found.toLowerCase()]??found);
 return [...replaced.matchAll(/(?:^|[^\d])([0-9]+(?:\.[0-9]{1,3})?)(?=$|[^\d])/g)]
   .map(x=>Number(x[1]));
}
function mentions(text:string,productName:string){
 const needle=normalize(productName);
 if(needle.length<3)return false;
 const hay=normalize(text);
 if(!hay.includes(needle))return false;
 const start=hay.indexOf(needle);
 const before=hay[start-1]??" ";
 const after=hay[start+needle.length]??" ";
 return !/[\p{L}\p{N}]/u.test(before)&&!/[\p{L}\p{N}]/u.test(after);
}
function unitMentioned(text:string,unit:string){
 const norm=normalize(text);
 const tokens:Record<string,string[]>={
   carton:["carton","cartons","కార్టన్","కార్టన్లు"],
   box:["box","boxes","బాక్స్","బాక్సులు"],
   pack:["pack","packs","packet","packets","ప్యాకెట్","ప్యాకెట్లు"],
   piece:["piece","pieces","pcs","పీసులు"],
   bag:["bag","bags","బస్తాలు"],
   kg:["kg","kilo","kilogram","కిలో","కిలోలు"],
   litre:["litre","liter","litres","liters","లీటర్లు"],
   bottle:["bottle","bottles","బాటిళ్లు"],
 };
 return (tokens[unit.toLowerCase()]??[unit]).some(x=>mentions(norm,x)||norm.split(" ").includes(normalize(x)));
}
const shortage=/(?:\bmissing\b|\bshort\b|\bshortage\b|\bless\b|\bnot received\b|తక్కువ|రాలేదు|మిస్సింగ్)/iu;
const damage=/(?:\bdamaged?\b|\bbroken\b|\bspoilt\b|పాడై|దెబ్బతిన్న|డ్యామేజ్)/iu;
const wrongVariantOrItem=/(?:\bwrong\b|\bdifferent\b|\bswapped\b|వేరే|తప్పు)/iu;
const unexpectedOrExcess=/(?:\bextra\b|\badditional\b|\bexcess\b|\bmore than billed\b|not invoiced|అదనంగా)/iu;

/**
 * Conservative baseline-scoped extraction of ONE specific spoken exception.
 * Does not use AI, make final arithmetic authoritative, or mark any line verified.
 * More than one matching product/quantity/issue -> targeted clarification.
 */
export function extractVoiceException(transcript:string,invoice:InvoiceEntry[]):ExtractionResult {
 const questions:string[]=[];
 const text=transcript.trim();
 if(!text) return {suggestions:[],questions:["Speak an exception or type it first."],verified:false};
 if(wrongVariantOrItem.test(text))return {
   suggestions:[],questions:["Wrong product or pack size: enter the actual received name and variant in the receipt. Voice cannot safely verify product identity."],verified:false,
 };
 if(unexpectedOrExcess.test(text))return {
   suggestions:[],questions:["Extra or unbilled goods: enter them in the unexpected-items section, or manually verify an excess receipt quantity."],verified:false,
 };
 const matched=invoice.filter(x=>mentions(text,x.productName));
 if(matched.length!==1) {
   questions.push(matched.length===0?
     "Which invoice product are you describing? Use the exact product name.":
     "Multiple invoice products were mentioned. Describe one item at a time.");
 }
 const values=numbers(text);
 if(values.length!==1||!Number.isFinite(values[0]))questions.push("How many units were affected? State one exact number.");
 const isMissing=shortage.test(text),isDamaged=damage.test(text);
 if(isMissing===isDamaged)questions.push("Is this a shortage or damaged goods? State only one type per voice clip.");
 const line=matched[0];
 if(line && !unitMentioned(text,line.unit))
   questions.push(`Which unit applies to ${line.productName}? The invoice uses ${line.unit}.`);
 if(questions.length||!line||values.length!==1) return {suggestions:[],questions,verified:false};
 const affected=values[0]!;
 const expected=Number(line.expected);
 if(!Number.isFinite(expected)||affected<0||affected===0||
   Math.abs(affected*1000-Math.round(affected*1000))>1e-7||affected>1000000){
   return {suggestions:[],questions:["Please confirm a positive affected quantity (up to three decimal places)."],verified:false};
 }
 if(isMissing && affected>expected) return {
   suggestions:[],questions:[`A shortage of ${affected} exceeds the invoice quantity ${expected}. Confirm the quantity.`],verified:false,
 };
 const suggestion:VoiceSuggestion={
   invoiceLineId:line.id,productName:line.productName,unit:line.unit,
   issueType:isMissing?"SHORTAGE":"DAMAGE",affectedQuantity:affected,
   suggestedReceived:isMissing?String(Number((expected-affected).toFixed(3))):null,
   suggestedDamaged:isDamaged?String(affected):null,
   confidence:"requires_confirmation",sourcePhrase:text,
 };
 return {suggestions:[suggestion],questions:[],verified:false};
}
