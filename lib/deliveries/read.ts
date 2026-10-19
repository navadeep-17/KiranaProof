import type { DeliveryDraft, InvoiceLine, ReceiptLine } from "../reconciliation/types.ts";

export interface StoredInvoice {
  id:string;product_name:string;variant:string;unit:string;expected_qty:number|string;
}
export interface StoredReceipt {
  invoice_line_id:string|null;received_product_name:string;received_variant:string;
  unit:string;received_qty:number|string|null;damaged_qty:number|string|null;
  identity_confirmed:boolean;condition_confirmed:boolean;
}
export interface StoredDelivery {
  invoice_complete_confirmed:boolean;unexpected_items_checked:boolean;
}
function amount(raw:number|string|null):number|null {
  if(raw===null) return null;
  const value=Number(raw);
  if(!Number.isFinite(value)) throw new Error("Invalid stored quantity");
  return value;
}
export function toStoredDraft(
  delivery:StoredDelivery,invoices:StoredInvoice[],receipts:StoredReceipt[],
):DeliveryDraft {
  const invoiceLines:InvoiceLine[]=invoices.map(row=>({
    id:row.id,productName:row.product_name,variant:row.variant,
    unit:row.unit,expectedQuantity:Number(row.expected_qty),
  }));
  const receiptLines:ReceiptLine[]=receipts.map(row=>({
    invoiceLineId:row.invoice_line_id,productName:row.received_product_name,
    variant:row.received_variant,unit:row.unit,
    receivedQuantity:amount(row.received_qty),damagedQuantity:amount(row.damaged_qty),
    identityConfirmed:row.identity_confirmed,conditionConfirmed:row.condition_confirmed,
  }));
  return {
    invoiceLines,receiptLines,
    invoiceCompleteConfirmed:delivery.invoice_complete_confirmed,
    unexpectedItemsChecked:delivery.unexpected_items_checked,
  };
}
