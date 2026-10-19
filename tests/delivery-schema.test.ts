import assert from "node:assert/strict";
import test from "node:test";
import { createDeliverySchema,evaluateSubmission } from "../lib/deliveries/schema.ts";
import { toStoredDraft } from "../lib/deliveries/read.ts";

function request(){
  return {
    clientRequestId:"d4ad1acb-7f83-4648-a69b-26a59259ad6f",
    storeName:"Sree Kirana",supplierName:"Ravi Distributors",
    referenceNumber:"INV-42",baselineType:"INVOICE",
    invoiceCompleteConfirmed:true,unexpectedItemsChecked:true,
    invoice:[{id:"local1",productName:"Parle-G",variant:"Carton of 24",unit:"carton",expected:"12"}],
    receipts:[{invoiceLineId:"local1",productName:"Parle-G",variant:"Carton of 24",unit:"carton",received:"12",damaged:"0",verified:true}],
    unexpected:[],
  };
}
test("validated clean snapshot only has reconciled eligibility",()=>{
  const parsed=createDeliverySchema.parse(request());
  const result=evaluateSubmission(parsed);
  assert.equal(result.result,"RECONCILED");
  assert.equal(result.canCreateClaim,false);
});
test("incomplete invoice is saveable but cannot be confirmed as reconciled",()=>{
  const p=request();p.invoiceCompleteConfirmed=false;
  const parsed=createDeliverySchema.parse(p);
  const result=evaluateSubmission(parsed);
  assert.equal(result.result,"NEEDS_REVIEW");
  assert.equal(result.canMarkReconciled,false);
  assert.equal(result.canCreateClaim,false);
});
test("client-supplied result field is rejected",()=>{
  assert.equal(createDeliverySchema.safeParse({...request(),result:"RECONCILED"}).success,false);
});
test("duplicate receipt mapping is rejected",()=>{
  const p=request();p.receipts.push({...p.receipts[0]});
  assert.equal(createDeliverySchema.safeParse(p).success,false);
});
test("stored snapshot accurately retains numeric quantities and unbilled goods",()=>{
  const draft=toStoredDraft(
    {invoice_complete_confirmed:true,unexpected_items_checked:true},
    [{id:"db1",product_name:"Parle-G",variant:"Carton of 24",unit:"carton",expected_qty:"12.000"}],
    [{invoice_line_id:"db1",received_product_name:"Parle-G",received_variant:"Carton of 24",unit:"carton",received_qty:"10.000",damaged_qty:"2.000",identity_confirmed:true,condition_confirmed:true},
      {invoice_line_id:null,received_product_name:"Extra",received_variant:"",unit:"pack",received_qty:"1.000",damaged_qty:"0.000",identity_confirmed:true,condition_confirmed:true}],
  );
  assert.equal(draft.receiptLines[0]?.receivedQuantity,10);
  assert.equal(draft.receiptLines[1]?.invoiceLineId,null);
});
