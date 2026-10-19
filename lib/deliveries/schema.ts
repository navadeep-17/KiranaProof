import { z } from "zod";
import { toDeliveryDraft } from "../reconciliation/form.ts";
import { reconcile } from "../reconciliation/engine.ts";

const numberField = z.string().max(30).regex(/^(?:|[0-9]+(?:\.[0-9]{1,3})?)$/);
const stringField = (n: number) => z.string().trim().max(n);
const invoiceRow = z.object({
  id: stringField(100).min(1),
  productName: stringField(150).min(1),
  variant: stringField(150),
  unit: stringField(24).min(1),
  expected: numberField.min(1),
}).strict();
const receiptRow = z.object({
  invoiceLineId: stringField(100).min(1),
  productName: stringField(150),
  variant: stringField(150),
  unit: stringField(24),
  received: numberField,
  damaged: numberField,
  verified: z.boolean(),
}).strict();
const unexpectedRow = z.object({
  id: stringField(100).min(1),
  productName: stringField(150).min(1),
  variant: stringField(150),
  unit: stringField(24).min(1),
  received: numberField,
  damaged: numberField,
  verified: z.boolean(),
}).strict();

const deliveryFields = z.object({
  storeName: stringField(100).min(1),
  supplierName: stringField(150).min(1),
  referenceNumber: stringField(120).min(1),
  baselineType: z.enum(["INVOICE","ORDER"]),
  invoice: z.array(invoiceRow).min(1).max(75),
  receipts: z.array(receiptRow).max(100),
  unexpected: z.array(unexpectedRow).max(25),
  invoiceCompleteConfirmed: z.boolean(),
  unexpectedItemsChecked: z.boolean(),
}).strict();

function validateLineMappings(
  value: z.infer<typeof deliveryFields>,
  ctx: z.RefinementCtx,
) {
  const ids = value.invoice.map(x => x.id);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({code:"custom",message:"Duplicate invoice ids",path:["invoice"]});
  }
  const receiptIds = value.receipts.map(x => x.invoiceLineId);
  if (new Set(receiptIds).size !== receiptIds.length ||
      receiptIds.some(x => !ids.includes(x))) {
    ctx.addIssue({code:"custom",message:"Invalid receipt-to-invoice mapping",path:["receipts"]});
  }
}

export const createDeliverySchema = deliveryFields
  .extend({clientRequestId:z.uuid()})
  .superRefine(validateLineMappings);

export const updateDeliverySchema = deliveryFields
  .extend({expectedVersion:z.number().int().positive()})
  .superRefine(validateLineMappings);

export const confirmDeliverySchema=z.object({expectedVersion:z.number().int().positive()}).strict();
export type CreateDeliveryInput=z.infer<typeof createDeliverySchema>;

export function evaluateSubmission(value:Omit<CreateDeliveryInput,"clientRequestId">) {
  return reconcile(toDeliveryDraft({
    invoice:value.invoice,receipts:value.receipts,unexpected:value.unexpected,
    invoiceCompleteConfirmed:value.invoiceCompleteConfirmed,
    unexpectedItemsChecked:value.unexpectedItemsChecked,
  }));
}

export function toDatabasePayload(value:Omit<CreateDeliveryInput,"clientRequestId">) {
  return {
    storeName:value.storeName,supplierName:value.supplierName,
    referenceNumber:value.referenceNumber,baselineType:value.baselineType,
    invoice:value.invoice,receipts:value.receipts,unexpected:value.unexpected,
    invoiceCompleteConfirmed:value.invoiceCompleteConfirmed,
    unexpectedItemsChecked:value.unexpectedItemsChecked,
  };
}
