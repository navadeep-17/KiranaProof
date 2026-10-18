import type { DeliveryDraft, InvoiceLine, ReceiptLine } from "./types.ts";

export interface InvoiceEntry {
  id: string;
  productName: string;
  variant: string;
  unit: string;
  expected: string;
}
export interface ReceiptEntry {
  invoiceLineId: string;
  productName: string;
  variant: string;
  unit: string;
  received: string;
  damaged: string;
  verified: boolean;
}
export interface UnexpectedEntry {
  id: string;
  productName: string;
  variant: string;
  unit: string;
  received: string;
  damaged: string;
  verified: boolean;
}
export interface WorkbenchSnapshot {
  invoice: InvoiceEntry[];
  receipts: ReceiptEntry[];
  unexpected: UnexpectedEntry[];
  invoiceCompleteConfirmed: boolean;
  unexpectedItemsChecked: boolean;
}

/** Reject invalid numeric input instead of silently coercing it to 0. */
export function readQuantity(raw: string, required: true): number;
export function readQuantity(raw: string, required: false): number | null;
export function readQuantity(raw: string, required: boolean): number | null {
  const input = raw.trim();
  if (input === "" && !required) return null;
  if (!/^[0-9]+(?:\.[0-9]{1,3})?$/.test(input)) {
    throw new Error("Quantity must be a nonnegative number with at most 3 decimal places.");
  }
  const quantity = Number(input);
  if (!Number.isSafeInteger(Math.round(quantity * 1000))) {
    throw new Error("Quantity is too large.");
  }
  return quantity;
}

/** Converts editable UI strings into authoritative domain inputs. */
export function toDeliveryDraft(snapshot: WorkbenchSnapshot): DeliveryDraft {
  if (snapshot.invoice.length === 0) throw new Error("Enter at least one invoice item.");
  const ids = new Set<string>();
  const invoiceLines: InvoiceLine[] = snapshot.invoice.map((line) => {
    if (ids.has(line.id)) throw new Error("Duplicate invoice item ID.");
    ids.add(line.id);
    if (!line.productName.trim() || !line.unit.trim()) {
      throw new Error("Product and unit are required on every invoice line.");
    }
    return {
      id: line.id,
      productName: line.productName.trim(),
      variant: line.variant.trim(),
      unit: line.unit.trim(),
      expectedQuantity: readQuantity(line.expected, true),
    };
  });

  const receiptLines: ReceiptLine[] = snapshot.receipts.map((line) => {
    if (!ids.has(line.invoiceLineId)) {
      throw new Error("A received item refers to a removed invoice line.");
    }
    return {
      invoiceLineId: line.invoiceLineId,
      productName: line.productName,
      variant: line.variant,
      unit: line.unit,
      receivedQuantity: readQuantity(line.received, false),
      damagedQuantity: readQuantity(line.damaged, false),
      identityConfirmed: line.verified,
      conditionConfirmed: line.verified,
    };
  });

  for (const line of snapshot.unexpected) {
    receiptLines.push({
      invoiceLineId: null,
      productName: line.productName,
      variant: line.variant,
      unit: line.unit,
      receivedQuantity: readQuantity(line.received, false),
      damagedQuantity: readQuantity(line.damaged, false),
      identityConfirmed: line.verified,
      conditionConfirmed: line.verified,
    });
  }
  return {
    invoiceLines,
    receiptLines,
    invoiceCompleteConfirmed: snapshot.invoiceCompleteConfirmed,
    unexpectedItemsChecked: snapshot.unexpectedItemsChecked,
  };
}
