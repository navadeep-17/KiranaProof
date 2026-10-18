import assert from "node:assert/strict";
import test from "node:test";
import { reconcile, ReconciliationInputError } from "../lib/reconciliation/engine.ts";
import { cleanDelivery, discrepancyDelivery, emptyReceiptDelivery } from "../lib/reconciliation/fixtures.ts";

test("complete, clean delivery is eligible for reconciliation with zero claims", () => {
  const r = reconcile(cleanDelivery());
  assert.equal(r.result, "RECONCILED");
  assert.equal(r.canMarkReconciled, true);
  assert.equal(r.canCreateClaim, false);
  assert.equal(r.discrepancies.length, 0);
  assert.equal(r.unresolved.length, 0);
});

test("unmentioned invoice line is not assumed delivered", () => {
  const r = reconcile(discrepancyDelivery());
  assert.equal(r.result, "NEEDS_REVIEW");
  assert.equal(r.canCreateClaim, false);
  assert.equal(r.discrepancies.length, 2);
  assert.equal(r.unresolved[0]?.invoiceLineId, "detergent");
});

test("zero received is distinct from missing quantity", () => {
  const d = cleanDelivery();
  d.receiptLines[0]!.receivedQuantity = 0;
  const r = reconcile(d);
  assert.equal(r.result, "HAS_DISCREPANCY");
  assert.equal(r.discrepancies.find((x) => x.type === "SHORTAGE")?.affectedQuantity, 12);
});

test("shortage and damage are separate and are not double-counted", () => {
  const d = cleanDelivery();
  d.receiptLines[0]!.receivedQuantity = 10;
  d.receiptLines[1]!.damagedQuantity = 2;
  const r = reconcile(d);
  assert.equal(r.result, "HAS_DISCREPANCY");
  assert.deepEqual(r.discrepancies.map((x) => x.type), ["SHORTAGE", "DAMAGE"]);
  assert.equal(r.discrepancies[0]?.affectedQuantity, 2);
  assert.equal(r.discrepancies[1]?.affectedQuantity, 2);
});

test("shortage and damage can coexist on the same line", () => {
  const d = cleanDelivery();
  d.receiptLines[0]!.receivedQuantity = 10;
  d.receiptLines[0]!.damagedQuantity = 1;
  assert.deepEqual(reconcile(d).discrepancies.map((x) => x.type), ["SHORTAGE", "DAMAGE"]);
});

test("excess goods are discrepancies", () => {
  const d = cleanDelivery();
  d.receiptLines[0]!.receivedQuantity = 13;
  assert.equal(reconcile(d).discrepancies[0]?.type, "EXCESS");
  assert.equal(reconcile(d).discrepancies[0]?.affectedQuantity, 1);
});

test("unexpected goods block clean reconciliation", () => {
  const d = cleanDelivery();
  d.receiptLines.push({
    invoiceLineId: null, productName: "Extra rice", variant: "1 kg", unit: "pack",
    receivedQuantity: 1, damagedQuantity: 0, identityConfirmed: true, conditionConfirmed: true,
  });
  assert.equal(reconcile(d).discrepancies.at(-1)?.type, "UNEXPECTED_ITEM");
});

test("wrong variant is flagged even if counts match", () => {
  const d = cleanDelivery();
  d.receiptLines[2]!.variant = "500 g";
  const r = reconcile(d);
  assert.deepEqual(r.discrepancies.map((x) => x.type), ["WRONG_VARIANT"]);
});

test("wrong product is flagged rather than converted into a shortage", () => {
  const d = cleanDelivery();
  d.receiptLines[0]!.productName = "Another biscuit";
  assert.equal(reconcile(d).discrepancies[0]?.type, "WRONG_ITEM");
});

test("carton versus packet requires clarification, not conversion", () => {
  const d = cleanDelivery();
  d.receiptLines[0]!.unit = "packet";
  const r = reconcile(d);
  assert.equal(r.result, "NEEDS_REVIEW");
  assert.equal(r.unresolved[0]?.code, "UNIT_MISMATCH");
  assert.equal(r.canCreateClaim, false);
});

test("unknown receipt quantity must never be treated as zero", () => {
  const d = cleanDelivery();
  d.receiptLines[0]!.receivedQuantity = null;
  assert.equal(reconcile(d).unresolved[0]?.code, "RECEIVED_QUANTITY_MISSING");
});

test("unknown damage status must never be treated as no damage", () => {
  const d = cleanDelivery();
  d.receiptLines[0]!.damagedQuantity = null;
  assert.equal(reconcile(d).unresolved[0]?.code, "DAMAGE_QUANTITY_MISSING");
});

test("unconfirmed identity blocks reconciliation", () => {
  const d = cleanDelivery();
  d.receiptLines[0]!.identityConfirmed = false;
  assert.equal(reconcile(d).result, "NEEDS_REVIEW");
});

test("even clean receipt data must include an explicit unexpected-items check", () => {
  const d = cleanDelivery();
  d.unexpectedItemsChecked = false;
  assert.equal(reconcile(d).result, "NEEDS_REVIEW");
  assert.equal(reconcile(d).unresolved.at(-1)?.code, "UNEXPECTED_ITEMS_UNCHECKED");
});

test("an empty invoice cannot be reconciled", () => {
  const d = emptyReceiptDelivery();
  d.invoiceLines = [];
  assert.equal(reconcile(d).result, "NEEDS_REVIEW");
});

test("duplicate or unrelated receipt IDs are rejected", () => {
  const d = cleanDelivery();
  d.receiptLines.push({ ...d.receiptLines[0]! });
  assert.throws(() => reconcile(d), ReconciliationInputError);
  d.receiptLines.pop();
  d.receiptLines[0]!.invoiceLineId = "not-in-invoice";
  assert.throws(() => reconcile(d), ReconciliationInputError);
});

test("negative, invalid precision or over-damage quantities are rejected", () => {
  const d = cleanDelivery();
  d.receiptLines[0]!.receivedQuantity = -1;
  assert.throws(() => reconcile(d), ReconciliationInputError);
  d.receiptLines[0]!.receivedQuantity = 1.00001;
  assert.throws(() => reconcile(d), ReconciliationInputError);
  d.receiptLines[0]!.receivedQuantity = 5;
  d.receiptLines[0]!.damagedQuantity = 6;
  assert.throws(() => reconcile(d), ReconciliationInputError);
});

test("changing previously confirmed data invalidates an old clean result", () => {
  const d = cleanDelivery();
  assert.equal(reconcile(d).result, "RECONCILED");
  d.receiptLines[1]!.receivedQuantity = 7;
  assert.equal(reconcile(d).result, "HAS_DISCREPANCY");
});

test("product casing or surrounding whitespace does not create false issues", () => {
  const d = cleanDelivery();
  d.receiptLines[0]!.productName = "  PARLE-g ";
  assert.equal(reconcile(d).result, "RECONCILED");
});
