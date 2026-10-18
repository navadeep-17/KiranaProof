import assert from "node:assert/strict";
import test from "node:test";
import { readQuantity, toDeliveryDraft } from "../lib/reconciliation/form.ts";
import { reconcile } from "../lib/reconciliation/engine.ts";
import type { WorkbenchSnapshot } from "../lib/reconciliation/form.ts";

function form(): WorkbenchSnapshot {
  return {
    invoice: [{ id: "a", productName: "Rice", variant: "5 kg", unit: "bag", expected: "4" }],
    receipts: [{
      invoiceLineId: "a", productName: "Rice", variant: "5 kg", unit: "bag",
      received: "4", damaged: "0", verified: true,
    }],
    unexpected: [],
    invoiceCompleteConfirmed: true,
    unexpectedItemsChecked: true,
  };
}

test("blank receipt quantity remains unknown, never zero", () => {
  const f = form();
  f.receipts[0]!.received = "";
  assert.equal(toDeliveryDraft(f).receiptLines[0]?.receivedQuantity, null);
  assert.equal(reconcile(toDeliveryDraft(f)).result, "NEEDS_REVIEW");
});

test("empty damage quantity remains unresolved", () => {
  const f = form();
  f.receipts[0]!.damaged = "";
  assert.equal(reconcile(toDeliveryDraft(f)).result, "NEEDS_REVIEW");
});

test("fractional unit quantities are supported exactly to three decimals", () => {
  assert.equal(readQuantity("1.125", true), 1.125);
  assert.equal(readQuantity("", false), null);
  assert.throws(() => readQuantity("1.0001", true));
  assert.throws(() => readQuantity("-2", true));
  assert.throws(() => readQuantity("NaN", true));
  assert.throws(() => readQuantity("", true));
});

test("incomplete invoice confirmation is never silently accepted", () => {
  const f = form();
  f.invoiceCompleteConfirmed = false;
  assert.equal(reconcile(toDeliveryDraft(f)).result, "NEEDS_REVIEW");
});

test("receipt validation captures wrong pack sizes", () => {
  const f = form();
  f.receipts[0]!.variant = "1 kg";
  assert.equal(reconcile(toDeliveryDraft(f)).discrepancies[0]?.type, "WRONG_VARIANT");
});

test("unexpected goods must be checked, even if all invoice items match", () => {
  const f = form();
  f.unexpectedItemsChecked = false;
  assert.equal(reconcile(toDeliveryDraft(f)).result, "NEEDS_REVIEW");
});

test("invalid baseline quantity fails rather than becoming NaN", () => {
  const f = form();
  f.invoice[0]!.expected = "";
  assert.throws(() => toDeliveryDraft(f));
});

test("confirmed clean delivery in the workbench produces no claim eligibility", () => {
  const result = reconcile(toDeliveryDraft(form()));
  assert.equal(result.result, "RECONCILED");
  assert.equal(result.canCreateClaim, false);
});
