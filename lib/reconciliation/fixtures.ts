import type { DeliveryDraft, InvoiceLine, ReceiptLine } from "./types.ts";

export const DEMO_INVOICE: InvoiceLine[] = [
  { id: "biscuits", productName: "Parle-G", variant: "Carton of 24", unit: "carton", expectedQuantity: 12 },
  { id: "soap", productName: "Lux Soap", variant: "Box", unit: "box", expectedQuantity: 8 },
  { id: "detergent", productName: "Surf Excel", variant: "1 kg", unit: "pack", expectedQuantity: 10 },
];

const verified = (
  line: InvoiceLine,
  receivedQuantity: number,
  damagedQuantity = 0,
): ReceiptLine => ({
  invoiceLineId: line.id,
  productName: line.productName,
  variant: line.variant,
  unit: line.unit,
  receivedQuantity,
  damagedQuantity,
  identityConfirmed: true,
  conditionConfirmed: true,
});

export function cleanDelivery(): DeliveryDraft {
  return {
    invoiceLines: DEMO_INVOICE.map((line) => ({ ...line })),
    receiptLines: DEMO_INVOICE.map((line) => verified(line, line.expectedQuantity)),
    invoiceCompleteConfirmed: true,
    unexpectedItemsChecked: true,
  };
}

export function discrepancyDelivery(): DeliveryDraft {
  return {
    invoiceLines: DEMO_INVOICE.map((line) => ({ ...line })),
    receiptLines: [
      verified(DEMO_INVOICE[0]!, 10),
      verified(DEMO_INVOICE[1]!, 8, 2),
      // The detergent line is deliberately unverified so the UI must ask.
    ],
    invoiceCompleteConfirmed: true,
    unexpectedItemsChecked: true,
  };
}

export function emptyReceiptDelivery(): DeliveryDraft {
  return {
    invoiceLines: DEMO_INVOICE.map((line) => ({ ...line })),
    receiptLines: [],
    invoiceCompleteConfirmed: false,
    unexpectedItemsChecked: false,
  };
}
