/** The human-confirmed, invoice-first inputs accepted by the rule engine. */
export interface InvoiceLine {
  id: string;
  productName: string;
  variant: string;
  unit: string;
  expectedQuantity: number;
}

export interface ReceiptLine {
  /** null/undefined denotes a product NOT present on the invoice. */
  invoiceLineId: string | null;
  productName: string;
  variant: string;
  unit: string;
  /** Unknown quantities must be null, NEVER silently coerced to zero. */
  receivedQuantity: number | null;
  damagedQuantity: number | null;
  identityConfirmed: boolean;
  conditionConfirmed: boolean;
}

export interface DeliveryDraft {
  invoiceLines: InvoiceLine[];
  receiptLines: ReceiptLine[];
  /** Retailer confirms the entered baseline contains EVERY line of the invoice/order. */
  invoiceCompleteConfirmed: boolean;
  /** Retailer actively checked for goods absent from the invoice. */
  unexpectedItemsChecked: boolean;
}

export type DeliveryResult = "RECONCILED" | "NEEDS_REVIEW" | "HAS_DISCREPANCY";

export type IssueType =
  | "SHORTAGE"
  | "EXCESS"
  | "DAMAGE"
  | "WRONG_ITEM"
  | "WRONG_VARIANT"
  | "UNEXPECTED_ITEM";

export interface Discrepancy {
  type: IssueType;
  invoiceLineId: string | null;
  productName: string;
  expectedQuantity: number | null;
  receivedQuantity: number | null;
  affectedQuantity: number | null;
  unit: string;
  detail: string;
}

export interface UnresolvedCheck {
  code:
    | "INVOICE_EMPTY"
    | "INVOICE_UNCONFIRMED"
    | "RECEIPT_UNVERIFIED"
    | "RECEIVED_QUANTITY_MISSING"
    | "DAMAGE_QUANTITY_MISSING"
    | "UNIT_MISMATCH"
    | "UNEXPECTED_ITEMS_UNCHECKED"
    | "UNEXPECTED_ITEM_UNVERIFIED";
  invoiceLineId: string | null;
  description: string;
}

export interface ReconciliationResult {
  result: DeliveryResult;
  fullyVerified: boolean;
  canMarkReconciled: boolean;
  canCreateClaim: boolean;
  discrepancies: Discrepancy[];
  unresolved: UnresolvedCheck[];
  checkedInvoiceLines: number;
  totalInvoiceLines: number;
}
