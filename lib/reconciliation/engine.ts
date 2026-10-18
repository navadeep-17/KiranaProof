import type {
  DeliveryDraft,
  Discrepancy,
  InvoiceLine,
  ReceiptLine,
  ReconciliationResult,
  UnresolvedCheck,
} from "./types.ts";

export class ReconciliationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReconciliationInputError";
  }
}

const normalized = (value: string): string =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-IN");

function quantity(value: number | null, field: string): void {
  if (value === null) return;
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    Math.abs(Math.round(value * 1000) - value * 1000) > 1e-7
  ) {
    throw new ReconciliationInputError(
      `${field} must be a nonnegative number with at most three decimal places`,
    );
  }
}

function validateDraft(draft: DeliveryDraft): void {
  if (typeof draft.invoiceCompleteConfirmed !== "boolean" || typeof draft.unexpectedItemsChecked !== "boolean") {
    throw new ReconciliationInputError("Invoice completeness and unexpected-items confirmations must be explicit booleans");
  }
  const invoiceIds = new Set<string>();
  for (const line of draft.invoiceLines) {
    if (!line.id.trim() || invoiceIds.has(line.id)) {
      throw new ReconciliationInputError("Invoice line IDs must be nonempty and unique");
    }
    invoiceIds.add(line.id);
    if (!line.productName.trim() || !line.unit.trim()) {
      throw new ReconciliationInputError(`Product and unit are required on ${line.id}`);
    }
    quantity(line.expectedQuantity, `Expected quantity for ${line.id}`);
  }

  const matchedIds = new Set<string>();
  for (const line of draft.receiptLines) {
    if (typeof line.identityConfirmed !== "boolean" || typeof line.conditionConfirmed !== "boolean") {
      throw new ReconciliationInputError("Each receipt confirmation must be a boolean");
    }
    quantity(line.receivedQuantity, "Received quantity");
    quantity(line.damagedQuantity, "Damaged quantity");
    if (
      line.receivedQuantity !== null &&
      line.damagedQuantity !== null &&
      line.damagedQuantity > line.receivedQuantity
    ) {
      throw new ReconciliationInputError("Damaged quantity cannot exceed received quantity");
    }
    if (line.invoiceLineId !== null) {
      if (!invoiceIds.has(line.invoiceLineId)) {
        throw new ReconciliationInputError("Receipt refers to a nonexistent invoice line");
      }
      if (matchedIds.has(line.invoiceLineId)) {
        throw new ReconciliationInputError("Multiple receipts refer to the same invoice line");
      }
      matchedIds.add(line.invoiceLineId);
    }
  }
}

function issue(
  type: Discrepancy["type"],
  invoice: InvoiceLine | null,
  receipt: ReceiptLine,
  affectedQuantity: number | null,
  detail: string,
): Discrepancy {
  return {
    type,
    invoiceLineId: invoice?.id ?? null,
    productName: invoice?.productName ?? receipt.productName,
    expectedQuantity: invoice?.expectedQuantity ?? null,
    receivedQuantity: receipt.receivedQuantity,
    affectedQuantity,
    unit: invoice?.unit ?? receipt.unit,
    detail,
  };
}

/**
 * Deterministic, pure reconciliation: never calls AI, touches a database,
 * changes source objects, creates a claim or finalizes a delivery.
 *
 * A RECONCILED result is ELIGIBILITY, not persisted confirmation.
 * Backend confirmation will eventually require an explicit user action.
 */
export function reconcile(draft: DeliveryDraft): ReconciliationResult {
  validateDraft(draft);

  const discrepancies: Discrepancy[] = [];
  const unresolved: UnresolvedCheck[] = [];
  const receiptsById = new Map(
    draft.receiptLines
      .filter((line): line is ReceiptLine & { invoiceLineId: string } =>
        line.invoiceLineId !== null,
      )
      .map((line) => [line.invoiceLineId, line]),
  );
  let checkedInvoiceLines = 0;
  const addUnresolved = (
    code: UnresolvedCheck["code"],
    invoiceLineId: string | null,
    description: string,
  ) => unresolved.push({ code, invoiceLineId, description });

  if (draft.invoiceLines.length === 0) {
    addUnresolved("INVOICE_EMPTY", null, "Add the complete invoice before reconciling.");
  }
  if (!draft.invoiceCompleteConfirmed) {
    addUnresolved("INVOICE_UNCONFIRMED", null, "Confirm that all lines from the invoice/order are entered.");
  }

  for (const invoice of draft.invoiceLines) {
    const receipt = receiptsById.get(invoice.id);
    if (
      !receipt ||
      !receipt.identityConfirmed ||
      !receipt.conditionConfirmed ||
      !receipt.productName.trim() ||
      (invoice.variant.trim().length > 0 && !receipt.variant.trim())
    ) {
      addUnresolved(
        "RECEIPT_UNVERIFIED",
        invoice.id,
        `Confirm product identity, received quantity and condition for ${invoice.productName}.`,
      );
      continue;
    }
    if (receipt.receivedQuantity === null) {
      addUnresolved(
        "RECEIVED_QUANTITY_MISSING",
        invoice.id,
        `How many ${invoice.unit} of ${invoice.productName} did you actually receive?`,
      );
      continue;
    }
    if (receipt.damagedQuantity === null) {
      addUnresolved(
        "DAMAGE_QUANTITY_MISSING",
        invoice.id,
        `How many received ${invoice.unit} of ${invoice.productName} were damaged (enter 0 if none)?`,
      );
      continue;
    }

    if (normalized(receipt.unit) !== normalized(invoice.unit)) {
      addUnresolved(
        "UNIT_MISMATCH",
        invoice.id,
        `Invoice uses ${invoice.unit}, but receipt uses ${receipt.unit} for ${invoice.productName}. Verify the units.`,
      );
      continue;
    }

    checkedInvoiceLines++;

    const wrongProduct = normalized(receipt.productName) !== normalized(invoice.productName);
    const wrongVariant = normalized(receipt.variant) !== normalized(invoice.variant);

    if (wrongProduct) {
      discrepancies.push(
        issue("WRONG_ITEM", invoice, receipt, null, "Received product differs from invoiced product."),
      );
    } else if (wrongVariant) {
      discrepancies.push(
        issue("WRONG_VARIANT", invoice, receipt, null, "Received variant or pack size differs from invoice."),
      );
    } else {
      // Only compare quantities when product, variant, and unit match.
      if (receipt.receivedQuantity < invoice.expectedQuantity) {
        discrepancies.push(
          issue(
            "SHORTAGE",
            invoice,
            receipt,
            Number((invoice.expectedQuantity - receipt.receivedQuantity).toFixed(3)),
            "Received quantity is below the invoiced quantity.",
          ),
        );
      }
      if (receipt.receivedQuantity > invoice.expectedQuantity) {
        discrepancies.push(
          issue(
            "EXCESS",
            invoice,
            receipt,
            Number((receipt.receivedQuantity - invoice.expectedQuantity).toFixed(3)),
            "Received quantity exceeds the invoiced quantity.",
          ),
        );
      }
    }
    // Damage is independent of item/variant mismatch; never drop a valid damage observation.
    // Damaged items were physically received; never double-count as missing.
    if (receipt.damagedQuantity > 0) {
      discrepancies.push(
        issue(
          "DAMAGE",
          invoice,
          receipt,
          receipt.damagedQuantity,
          "Damaged units are part of the received quantity.",
        ),
      );
    }
  }

  for (const receipt of draft.receiptLines.filter((line) => line.invoiceLineId === null)) {
    if (
      !receipt.identityConfirmed ||
      !receipt.conditionConfirmed ||
      receipt.receivedQuantity === null ||
      receipt.damagedQuantity === null ||
      !receipt.productName.trim() ||
      !receipt.unit.trim()
    ) {
      addUnresolved(
        "UNEXPECTED_ITEM_UNVERIFIED",
        null,
        "An item not on the invoice needs complete identification and quantity verification.",
      );
    } else if (receipt.receivedQuantity > 0) {
      discrepancies.push(
        issue("UNEXPECTED_ITEM", null, receipt, receipt.receivedQuantity, "Item not listed on invoice."),
      );
      if (receipt.damagedQuantity > 0) {
        discrepancies.push(
          issue("DAMAGE", null, receipt, receipt.damagedQuantity, "Unexpected goods were also damaged."),
        );
      }
    }
  }

  if (!draft.unexpectedItemsChecked) {
    addUnresolved(
      "UNEXPECTED_ITEMS_UNCHECKED",
      null,
      "Confirm whether any additional goods arrived that are not listed on the invoice.",
    );
  }

  const fullyVerified = unresolved.length === 0;
  const result = !fullyVerified
    ? "NEEDS_REVIEW"
    : discrepancies.length > 0
      ? "HAS_DISCREPANCY"
      : "RECONCILED";

  return {
    result,
    fullyVerified,
    canMarkReconciled: result === "RECONCILED",
    canCreateClaim: result === "HAS_DISCREPANCY",
    discrepancies,
    unresolved,
    checkedInvoiceLines,
    totalInvoiceLines: draft.invoiceLines.length,
  };
}
