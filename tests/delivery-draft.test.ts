import assert from "node:assert/strict";
import test from "node:test";
import { createDeliverySchema, updateDeliverySchema, toDatabasePayload, evaluateSubmission } from "../lib/deliveries/schema.ts";

const input=()=>({
  clientRequestId:"f0337448-cc3d-4299-89e3-de5b9b986e94",
  storeName:"Test Kirana",supplierName:"Test Supplier",referenceNumber:"INV-001",
  baselineType:"INVOICE" as const,invoiceCompleteConfirmed:false,unexpectedItemsChecked:false,
  invoice:[{id:"line1",productName:"Soap",variant:"Box",unit:"box",expected:"8"}],
  receipts:[],unexpected:[],
});
test("partial baseline is valid to SAVE but never eligible for reconciliation",()=>{
  const parsed=createDeliverySchema.parse(input());
  assert.equal(evaluateSubmission(parsed).result,"NEEDS_REVIEW");
});
test("edit payload has expected version and rejects client-selected status",()=>{
  const i=input();const {clientRequestId,...draft}=i;
  assert.equal(updateDeliverySchema.safeParse({...draft,expectedVersion:2}).success,true);
  assert.equal(updateDeliverySchema.safeParse({...draft,expectedVersion:0}).success,false);
  assert.equal(updateDeliverySchema.safeParse({...draft,expectedVersion:2,status:"RECONCILED"}).success,false);
});
test("database payload excludes client approval and version metadata",()=>{
  const parsed=createDeliverySchema.parse(input());
  const payload=toDatabasePayload(parsed);
  assert.equal("clientRequestId" in payload,false);
  assert.equal("result" in payload,false);
  assert.equal("expectedVersion" in payload,false);
  assert.equal(payload.invoiceCompleteConfirmed,false);
});
