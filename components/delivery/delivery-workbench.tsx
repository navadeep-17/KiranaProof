"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Boxes, Check, CheckCircle2, ChevronLeft,
  ClipboardCheck, FileCheck2, FilePlus2, Info, PackageCheck, Plus,
  RotateCcw, ShieldAlert, Trash2, TriangleAlert, WandSparkles,
} from "lucide-react";
import { reconcile, ReconciliationInputError } from "@/lib/reconciliation/engine";
import type { ReconciliationResult } from "@/lib/reconciliation/types";
import { toDeliveryDraft } from "@/lib/reconciliation/form";
import type { InvoiceEntry, ReceiptEntry, UnexpectedEntry } from "@/lib/reconciliation/form";

const units = ["carton", "box", "pack", "piece", "bag", "kg", "litre", "bottle"];
const newId = () => crypto.randomUUID();
const makeInvoice = (): InvoiceEntry => ({
  id: newId(), productName: "", variant: "", unit: "carton", expected: "",
});
const initialInvoice = (): InvoiceEntry[] => [{ id: "starter-1", productName: "", variant: "", unit: "carton", expected: "" }];
const fromInvoice = (line: InvoiceEntry): ReceiptEntry => ({
  invoiceLineId: line.id,
  productName: line.productName,
  variant: line.variant,
  unit: line.unit,
  received: "",
  damaged: "",
  verified: false,
});

const stepInfo = [
  { title: "Invoice", description: "What was billed" },
  { title: "Received", description: "What arrived" },
  { title: "Result", description: "Compare & review" },
];

function Field({
  label, value, onChange, placeholder = "", inputMode,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; inputMode?: "decimal" | "text";
}) {
  return (
    <label className="block min-w-0">
      <span className="field-label">{label}</span>
      <input className="input" value={value} placeholder={placeholder}
        inputMode={inputMode} onChange={(e) => onChange(e.target.value)}/>
    </label>
  );
}

function UnitField({
  value, onChange, label = "Unit",
}: {
  value: string; onChange: (v: string) => void; label?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
        {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
      </select>
    </label>
  );
}

function CheckLine({
  checked, onChange, children,
}: {
  checked: boolean; onChange: (checked: boolean) => void; children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-[#4b5e6c]">
      <input type="checkbox" className="soft-check mt-1" checked={checked}
        onChange={(e) => onChange(e.target.checked)}/>
      <span>{children}</span>
    </label>
  );
}

function IssueCard({
  result,
}: { result: ReconciliationResult }) {
  if (result.result === "RECONCILED") {
    return (
      <div className="rounded-[22px] border border-[#cbe7d4] bg-[#f1faf3] px-6 py-7">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#dbefdf] text-[#216843]"><CheckCircle2 size={25}/></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.11em] text-[#2d7655]">Fully verified</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-[-.04em] text-[#1d5439]">Eligible for reconciliation</h2>
            <p className="mt-2 text-sm leading-6 text-[#4c745f]">Every entered invoice line was checked, with correct goods, quantities and condition. No unexpected goods were reported. <strong>No discrepancy claim is needed.</strong></p>
          </div>
        </div>
      </div>
    );
  }
  if (result.result === "NEEDS_REVIEW") {
    return (
      <div className="rounded-[22px] border border-[#f3ddbc] bg-[#fff9ed] px-6 py-7">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#f7e8c5] text-[#95661b]"><ShieldAlert size={24}/></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.11em] text-[#946618]">Not safe to finalize</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-[-.04em] text-[#70521f]">Needs review</h2>
            <p className="mt-2 text-sm leading-6 text-[#866b40]">{result.unresolved.length} checks remain unresolved. The delivery cannot be marked reconciled or turned into a claim yet.</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-[22px] border border-[#f1cfbf] bg-[#fff5f0] px-6 py-7">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#f8e3d7] text-[#b9602d]"><TriangleAlert size={24}/></span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.11em] text-[#aa5626]">Verified discrepancy</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-[-.04em] text-[#823f24]">Discrepancy detected</h2>
          <p className="mt-2 text-sm leading-6 text-[#94674f]">Review the affected items below. A supplier claim will only be created after your approval in a future milestone.</p>
        </div>
      </div>
    </div>
  );
}

export function DeliveryWorkbench() {
  const router = useRouter();
  const [storeName,setStoreName] = useState("My Kirana Store");
  const [saving,setSaving] = useState(false);
  const [requestKey,setRequestKey] = useState<string | null>(null);
  const [savedDelivery,setSavedDelivery] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [supplier, setSupplier] = useState("");
  const [reference, setReference] = useState("");
  const [baselineType, setBaselineType] = useState<"INVOICE" | "ORDER">("INVOICE");
  const [invoice, setInvoice] = useState<InvoiceEntry[]>(initialInvoice);
  const [invoiceComplete, setInvoiceComplete] = useState(false);
  const [receipts, setReceipts] = useState<ReceiptEntry[]>([]);
  const [unexpected, setUnexpected] = useState<UnexpectedEntry[]>([]);
  const [unexpectedChecked, setUnexpectedChecked] = useState(false);
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => { setResult(null); setError(null); setRequestKey(null); setSavedDelivery(null); };
  const updateInvoice = (id: string, patch: Partial<InvoiceEntry>) => {
    setInvoice((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
    setInvoiceComplete(false);
    setReceipts([]);
    setUnexpectedChecked(false);
    invalidate();
  };
  const addInvoice = () => {
    setInvoice((rows) => [...rows, makeInvoice()]);
    setInvoiceComplete(false);
    setReceipts([]);
    setUnexpectedChecked(false);
    invalidate();
  };
  const removeInvoice = (id: string) => {
    setInvoice((rows) => rows.filter((row) => row.id !== id));
    setInvoiceComplete(false);
    setReceipts([]);
    setUnexpectedChecked(false);
    invalidate();
  };
  const loadSample = () => {
    setSupplier("Ravi Distributors (demo)");
    setReference("INV-1208");
    setBaselineType("INVOICE");
    setInvoice([
      { id: "biscuits-demo", productName: "Parle-G", variant: "Carton of 24", unit: "carton", expected: "12" },
      { id: "soap-demo", productName: "Lux Soap", variant: "Box", unit: "box", expected: "8" },
      { id: "detergent-demo", productName: "Surf Excel", variant: "1 kg", unit: "pack", expected: "10" },
    ]);
    setInvoiceComplete(false);
    setReceipts([]);
    setUnexpected([]);
    setUnexpectedChecked(false);
    setStep(0);
    invalidate();
  };

  const updateReceipt = (id: string, patch: Partial<ReceiptEntry>) => {
    setReceipts((rows) => rows.map((r) => r.invoiceLineId === id ? { ...r, ...patch, verified: false } : r));
    invalidate();
  };
  const setReceiptVerified = (id: string, verified: boolean) => {
    setReceipts((rows) => rows.map((r) => r.invoiceLineId === id ? { ...r, verified } : r));
    invalidate();
  };
  const markReceiptCorrect = (id: string) => {
    const match = invoice.find((line) => line.id === id);
    if (!match) return;
    setReceipts((rows) => rows.map((r) => r.invoiceLineId === id ? {
      ...r, productName: match.productName, variant: match.variant,
      unit: match.unit, received: match.expected, damaged: "0", verified: true,
    } : r));
    invalidate();
  };
  const markRemainingCorrect = () => {
    // Never erase an unverified shortage/damage that the user has started entering.
    // Only untouched receipt rows can be confirmed through the bulk action.
    setReceipts((rows) => rows.map((r) => {
      if (r.verified || r.received.trim() !== "" || r.damaged.trim() !== "") return r;
      const match = invoice.find((line) => line.id === r.invoiceLineId);
      if (!match ||
        r.productName.trim() !== match.productName.trim() ||
        r.variant.trim() !== match.variant.trim() ||
        r.unit !== match.unit) return r;
      return {
        ...r, productName: match.productName, variant: match.variant,
        unit: match.unit, received: match.expected, damaged: "0", verified: true,
      };
    }));
    invalidate();
  };
  const updateUnexpected = (id: string, patch: Partial<UnexpectedEntry>) => {
    setUnexpected((rows) => rows.map((r) => r.id === id ? { ...r, ...patch, verified: false } : r));
    invalidate();
  };

  const goToReceipts = () => {
    setError(null);
    try {
      if (!supplier.trim() || !reference.trim()) {
        throw new Error("Enter a supplier and invoice/order reference.");
      }
      const draft = toDeliveryDraft({
        invoice, receipts: [], unexpected: [], invoiceCompleteConfirmed: invoiceComplete,
        unexpectedItemsChecked: false,
      });
      if (draft.invoiceLines.length === 0) throw new Error("At least one invoice line is required.");
      if (!invoiceComplete) {
        throw new Error("Confirm that every line on the invoice/order has been entered.");
      }
      setReceipts((old) => {
        const byId = new Map(old.map((r) => [r.invoiceLineId, r]));
        return invoice.map((line) => byId.get(line.id) ?? fromInvoice(line));
      });
      setStep(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid invoice details.");
    }
  };
  const evaluate = () => {
    setError(null);
    try {
      const draft = toDeliveryDraft({
        invoice, receipts, unexpected,
        invoiceCompleteConfirmed: invoiceComplete,
        unexpectedItemsChecked: unexpectedChecked,
      });
      const nextResult = reconcile(draft);
      setResult(nextResult);
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof ReconciliationInputError || e instanceof Error ? e.message : "Could not reconcile delivery.");
    }
  };

  const saveAndConfirm = async () => {
    if(!result || result.result==="NEEDS_REVIEW") {
      setError("Resolve all checks before confirming the delivery.");
      return;
    }
    if(saving) return;
    setSaving(true);
    setError(null);
    try {
      const id=requestKey ?? crypto.randomUUID();
      setRequestKey(id);
      const saved=await fetch("/api/v1/deliveries",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          clientRequestId:id,storeName,supplierName:supplier,referenceNumber:reference,
          baselineType,invoice,receipts,unexpected,
          invoiceCompleteConfirmed:invoiceComplete,unexpectedItemsChecked:unexpectedChecked,
        }),
      });
      const data=await saved.json();
      if(!saved.ok) {
        if(saved.status===401) throw new Error("Sign in first to save. The current workbench stays open so you can sign in in a second tab.");
        throw new Error(data.error ?? "Unable to save delivery.");
      }
      setSavedDelivery(data.id);
      if(data.status==="RECONCILED" || data.status==="HAS_DISCREPANCY") {
        router.push(`/deliveries/${encodeURIComponent(data.id)}`);
        router.refresh();
        return;
      }
      const confirmed=await fetch(`/api/v1/deliveries/${encodeURIComponent(data.id)}/confirm`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({expectedVersion:data.version}),
      });
      const confirmation=await confirmed.json();
      if(!confirmed.ok) throw new Error(confirmation.error ?? "Saved as draft, but could not confirm.");
      router.push(`/deliveries/${encodeURIComponent(data.id)}`);
      router.refresh();
    }catch(cause) {
      setError(cause instanceof Error ? cause.message : "Could not save delivery.");
    }finally {
      setSaving(false);
    }
  };

  const verifiedCount = receipts.filter((r) => r.verified).length;
  const issuesCount = result?.discrepancies.length ?? 0;

  return (
    <div className="min-h-screen bg-[#f7f7f2]">
      <header className="border-b border-[#e3e7e5] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link href="/" className="flex items-center gap-3 text-lg font-extrabold tracking-[-.045em]">
            <span className="brand-mark"><Boxes size={20}/></span>
            <span>Kirana<span className="text-[#d46b2b]">Proof</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-[#f6f0e7] px-3 py-1.5 text-[11px] font-bold text-[#a76837] sm:block">MILESTONE 3 · SAVE & CONFIRM</span>
            <Link href="/login" target="_blank" className="btn btn-outline !min-h-9 !px-3 !py-1.5">Sign in to save</Link>
            <Link href="/" className="btn btn-outline !min-h-9 !px-3 !py-1.5"><ArrowLeft size={15}/> Home</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-20 pt-9 md:pt-12">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="kicker">Delivery intake / Manual reconciliation</p>
            <h1 className="mt-2 text-[clamp(2rem,4vw,2.8rem)] font-extrabold tracking-[-.055em] text-[#152b3c]">Verify a delivery</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6a7987]">Compare the complete invoice with the actual goods received. Unknown details remain pending until you verify them.</p>
          </div>
          <button onClick={loadSample} className="btn btn-outline shrink-0"><WandSparkles size={16}/> Load sample invoice</button>
        </div>

        <div className="mb-6 rounded-xl border border-[#dce7ea] bg-[#eef5f7] px-4 py-3 text-xs leading-5 text-[#456274]">
          <span className="inline-flex items-start gap-2"><Info size={16} className="mt-0.5 shrink-0"/>
            <span><strong>Invoice-first:</strong> comparisons use our tested rule engine. Once every line is verified, you can sign in and explicitly confirm the saved delivery. Supplier claims and voice features will follow in later milestones.</span>
          </span>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-2">
          {stepInfo.map((item, index) => (
            <div key={item.title} aria-current={step === index ? "step" : undefined}
              className={"flex items-center gap-3 rounded-xl border px-3 py-3 sm:px-5 " + (step === index ? "border-[#ca9a76] bg-[#fff5eb]" : index < step ? "border-[#cee4d8] bg-[#f2faf4]" : "border-[#e4e8e5] bg-white")}>
              <span className={"grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold " +
                (step === index ? "bg-[#d46b2b] text-white" : index < step ? "bg-[#ddeee4] text-[#267454]" : "bg-[#f0f2f3] text-[#788894]")}>
                {index < step ? <Check size={16}/> : index + 1}
              </span>
              <span><span className="block text-sm font-bold text-[#253746]">{item.title}</span><span className="hidden text-[11px] text-[#7b8790] sm:block">{item.description}</span></span>
            </div>
          ))}
        </div>

        {error && <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-[#ebc5b7] bg-[#fff0ea] px-4 py-4 text-sm text-[#93432e]"><TriangleAlert className="shrink-0" size={19}/>{error}</div>}

        {step === 0 && (
          <div className="space-y-5">
            <section className="surface rounded-[22px] p-5 sm:p-7">
              <div className="mb-5 flex items-start justify-between">
                <div><p className="kicker">01 / Invoice baseline</p><h2 className="mt-1 text-xl font-extrabold tracking-[-.03em]">Delivery details</h2></div>
                <FilePlus2 className="text-[#477063]" size={25}/>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Shop name *" placeholder="e.g. Sree Kirana" value={storeName} onChange={(v) => {setStoreName(v);invalidate();}}/>
                <Field label="Supplier / distributor *" placeholder="e.g. Ravi Distributors" value={supplier} onChange={(v) => { setSupplier(v); invalidate(); }}/>
                <Field label="Invoice / order reference *" placeholder="e.g. INV-1208" value={reference} onChange={(v) => { setReference(v); invalidate(); }}/>
                <label className="block"><span className="field-label">Baseline document</span>
                  <select className="input" value={baselineType} onChange={(e) => { setBaselineType(e.target.value as "INVOICE" | "ORDER"); setInvoiceComplete(false); invalidate(); }}>
                    <option value="INVOICE">Invoice</option><option value="ORDER">Order</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="surface rounded-[22px] p-5 sm:p-7">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div><p className="kicker">The full baseline is mandatory</p><h2 className="mt-1 text-xl font-extrabold tracking-[-.03em]">Billed items <span className="text-[#a2adb0]">({invoice.length})</span></h2></div>
                <button className="btn btn-outline" onClick={addInvoice}><Plus size={16}/> Add item</button>
              </div>
              <div className="space-y-3">
                {invoice.map((line, index) => (
                  <div className="rounded-2xl border border-[#e7ecea] bg-[#fcfdfc] p-4" key={line.id}>
                    <div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold text-[#5d736e]">LINE {String(index + 1).padStart(2, "0")}</span>
                      <button className="rounded-lg p-2 text-[#9b8b85] hover:bg-[#fff0eb] hover:text-[#c04a36]" title="Remove invoice line" aria-label={"Remove line " + (index + 1)} onClick={() => removeInvoice(line.id)}><Trash2 size={16}/></button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_1.1fr_.8fr_.8fr]">
                      <Field label="Product *" value={line.productName} placeholder="e.g. Parle-G" onChange={(v) => updateInvoice(line.id, { productName: v })}/>
                      <Field label="Variant / pack size" value={line.variant} placeholder="e.g. Carton of 24" onChange={(v) => updateInvoice(line.id, { variant: v })}/>
                      <Field label="Billed quantity *" value={line.expected} placeholder="12" inputMode="decimal" onChange={(v) => updateInvoice(line.id, { expected: v })}/>
                      <UnitField value={line.unit} onChange={(v) => updateInvoice(line.id, { unit: v })}/>
                    </div>
                  </div>
                ))}
              </div>
              {invoice.length === 0 && <p className="rounded-xl bg-[#fff7ec] p-4 text-sm text-[#8f6537]">Add at least one line before continuing.</p>}
              <div className="mt-6 rounded-xl border border-[#dce8e2] bg-[#f6faf7] p-4">
                <CheckLine checked={invoiceComplete} onChange={(v) => { setInvoiceComplete(v); invalidate(); }}>
                  <strong>I confirm every line from this {baselineType.toLowerCase()} has been entered.</strong>
                  <span className="block text-xs text-[#728478]">We cannot reconcile a delivery against only part of its invoice.</span>
                </CheckLine>
              </div>
            </section>
            <div className="flex justify-end"><button className="btn btn-primary w-full sm:w-auto" onClick={goToReceipts}>Continue to received items <ArrowRight size={17}/></button></div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <section className="surface rounded-[22px] p-5 sm:p-7">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div><p className="kicker">02 / Receipt verification</p><h2 className="mt-1 text-xl font-extrabold tracking-[-.03em]">What actually arrived?</h2><p className="mt-1 text-xs text-[#82908e]">{verifiedCount} of {invoice.length} lines explicitly verified</p></div>
                <button className="btn btn-outline" onClick={markRemainingCorrect}><PackageCheck size={17}/> Confirm untouched lines correct</button>
              </div>
              <div className="mb-5 rounded-xl bg-[#fff8ed] px-4 py-3 text-xs leading-5 text-[#85683d]">
                <strong>Use the bulk action only after checking every remaining item.</strong> It confirms billed quantity and zero damage only on untouched rows. Partially entered differences are never overwritten. This is your explicit assertion, not AI inference.
              </div>
              <div className="space-y-4">
                {invoice.map((line, index) => {
                  const receipt = receipts.find((r) => r.invoiceLineId === line.id);
                  if (!receipt) return null;
                  return (
                    <article key={line.id} className={"rounded-2xl border p-4 sm:p-5 " + (receipt.verified ? "border-[#d2e9da] bg-[#fcfffc]" : "border-[#e1e6e6] bg-white")}>
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                        <div><p className="text-[11px] font-bold uppercase tracking-[.09em] text-[#95a09b]">Invoice line {index + 1}</p><h3 className="mt-1 text-lg font-extrabold text-[#263b47]">{line.productName}</h3><p className="mt-1 text-xs text-[#7f8c91]">Billed: <strong>{line.expected} {line.unit}</strong> · {line.variant || "No variant"}</p></div>
                        <button onClick={() => markReceiptCorrect(line.id)} className="btn btn-outline !min-h-9 !px-3 !py-2 text-[11px]"><CheckCircle2 size={15}/> Received correctly</button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_1.1fr_.8fr_.8fr]">
                        <Field label="Received product *" value={receipt.productName} onChange={(v) => updateReceipt(line.id, { productName: v })}/>
                        <Field label="Received variant / pack" value={receipt.variant} onChange={(v) => updateReceipt(line.id, { variant: v })}/>
                        <Field label="Quantity received *" value={receipt.received} placeholder="Unknown" inputMode="decimal" onChange={(v) => updateReceipt(line.id, { received: v })}/>
                        <Field label="Damaged quantity *" value={receipt.damaged} placeholder="Unknown" inputMode="decimal" onChange={(v) => updateReceipt(line.id, { damaged: v })}/>
                      </div>
                      <div className="mt-3 grid items-end gap-3 sm:grid-cols-[160px_1fr]">
                        <UnitField value={receipt.unit} label="Received unit" onChange={(v) => updateReceipt(line.id, { unit: v })}/>
                        <div className="rounded-xl bg-[#f5f8f6] px-3 py-3">
                          <CheckLine checked={receipt.verified} onChange={(v) => setReceiptVerified(line.id, v)}>
                            <strong>I verified this product, variant, received count and condition.</strong>
                          </CheckLine>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
            <section className="surface rounded-[22px] p-5 sm:p-7">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div><p className="kicker">Items outside the invoice</p><h2 className="mt-1 text-xl font-extrabold tracking-[-.03em]">Unexpected goods</h2><p className="mt-1 text-xs text-[#83918e]">Record products received but absent from the invoice.</p></div>
                <button onClick={() => { setUnexpected((rows) => [...rows, { id: newId(), productName: "", variant: "", unit: "pack", received: "", damaged: "", verified: false }]); invalidate(); }}
                  className="btn btn-outline shrink-0"><Plus size={16}/> <span className="hidden sm:inline">Add unexpected</span><span className="sm:hidden">Add</span></button>
              </div>
              <div className="space-y-3">
                {unexpected.map((row, index) => (
                  <article key={row.id} className="rounded-2xl border border-[#efe0ce] bg-[#fffcf9] p-4">
                    <div className="mb-3 flex justify-between"><span className="text-xs font-bold text-[#947b62]">EXTRA ITEM {index + 1}</span><button aria-label={"Remove extra item " + (index + 1)} onClick={() => { setUnexpected((rows) => rows.filter((x) => x.id !== row.id)); invalidate(); }} className="text-[#b66448]"><Trash2 size={16}/></button></div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Field label="Product" value={row.productName} onChange={(v) => updateUnexpected(row.id, { productName: v })}/>
                      <Field label="Variant" value={row.variant} onChange={(v) => updateUnexpected(row.id, { variant: v })}/>
                      <Field label="Received" value={row.received} inputMode="decimal" onChange={(v) => updateUnexpected(row.id, { received: v })}/>
                      <Field label="Damaged" value={row.damaged} inputMode="decimal" onChange={(v) => updateUnexpected(row.id, { damaged: v })}/>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[150px_1fr]">
                      <UnitField value={row.unit} onChange={(v) => updateUnexpected(row.id, { unit: v })}/>
                      <div className="flex items-end pb-3"><CheckLine checked={row.verified} onChange={(v) => { setUnexpected((rows) => rows.map((r) => r.id === row.id ? { ...r, verified: v } : r)); invalidate(); }}>Verified item, quantity and condition</CheckLine></div>
                    </div>
                  </article>
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-[#dce8e2] bg-[#f6faf7] p-4">
                <CheckLine checked={unexpectedChecked} onChange={(v) => { setUnexpectedChecked(v); invalidate(); }}>
                  <strong>I checked for goods not listed on the {baselineType.toLowerCase()}.</strong> Any extra items are listed above.
                </CheckLine>
              </div>
            </section>
            <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
              <button className="btn btn-outline" onClick={() => { setStep(0); setError(null); }}><ChevronLeft size={17}/> Edit invoice</button>
              <button className="btn btn-primary" onClick={evaluate}>Run full reconciliation <ArrowRight size={17}/></button>
            </div>
          </div>
        )}

        {step === 2 && result && (
          <div className="space-y-5">
            <IssueCard result={result}/>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["Invoice lines", String(result.totalInvoiceLines), "Loaded from baseline"],
                ["Verified lines", String(result.checkedInvoiceLines), "Product, quantity, condition"],
                ["Issue findings", String(issuesCount), "Confirmed mismatches"],
              ].map(([label, value, note]) => (
                <div key={label} className="surface rounded-2xl px-5 py-4">
                  <div className="text-xs font-semibold text-[#7d898f]">{label}</div>
                  <div className="mt-2 text-3xl font-extrabold tracking-[-.05em]">{value}</div>
                  <div className="mt-1 text-[11px] text-[#9aa4a7]">{note}</div>
                </div>
              ))}
            </div>
            {result.unresolved.length > 0 && (
              <section className="surface rounded-[22px] p-5 sm:p-7">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold"><ShieldAlert size={20} className="text-[#ab7c23]"/> Questions to resolve</h2>
                <div className="space-y-2">{result.unresolved.map((check, i) => (
                  <div key={i} className="rounded-xl border border-[#f0e5d4] bg-[#fffaf3] p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#9a7a42]">{check.code.replaceAll("_", " ")}</div>
                    <p className="mt-1 text-sm text-[#694f31]">{check.description}</p>
                  </div>
                ))}</div>
              </section>
            )}
            {result.discrepancies.length > 0 && (
              <section className="surface rounded-[22px] p-5 sm:p-7">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div><p className="kicker">Affected items only</p><h2 className="mt-1 text-xl font-extrabold tracking-[-.03em]">Discrepancy findings</h2></div>
                  <TriangleAlert size={22} className="text-[#c07546]"/>
                </div>
                <div className="space-y-3">
                  {result.discrepancies.map((finding, index) => (
                    <div key={index} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f0e3d8] p-4">
                      <div><span className="rounded-md bg-[#fff1e6] px-2.5 py-1 text-[10px] font-bold text-[#a55e32]">{finding.type.replaceAll("_", " ")}</span><h3 className="mt-2 font-extrabold text-[#2b3b46]">{finding.productName}</h3><p className="mt-1 max-w-md text-xs leading-5 text-[#788590]">{finding.detail}</p></div>
                      <div className="text-right"><div className="text-lg font-extrabold text-[#a45729]">{finding.affectedQuantity === null ? "Review" : finding.affectedQuantity + " " + finding.unit}</div><div className="text-[11px] text-[#909aa1]">Affected quantity</div></div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <section className="rounded-[20px] border border-dashed border-[#cfdadd] bg-[#f8fbfb] p-5">
              <div className="flex items-start gap-3"><Info size={19} className="mt-0.5 shrink-0 text-[#497889]"/><div className="text-sm text-[#59717d]"><strong>Review before saving.</strong> A delivery is saved only when you choose Confirm and save. Correct deliveries create no claims; discrepant deliveries retain findings but do not contact a supplier.</div></div>
            </section>
            {savedDelivery && (
              <div role="status" className="rounded-xl border border-[#cfe2d6] bg-[#f0faf3] p-4 text-sm text-[#295f42]">
                Delivery saved. If confirmation failed, <Link className="font-bold underline" href={`/deliveries/${savedDelivery}`}>open the saved record</Link>.
              </div>
            )}
            <div className="flex flex-col-reverse flex-wrap justify-between gap-3 sm:flex-row">
              <button disabled={saving} className="btn btn-outline" onClick={() => { setStep(1); setError(null); }}><ChevronLeft size={17}/> Correct received items</button>
              {result.fullyVerified && (
                <button disabled={saving} className="btn btn-primary" onClick={saveAndConfirm}>
                  <CheckCircle2 size={17}/>{saving ? "Saving and confirming..." : result.result==="RECONCILED" ? "Confirm clean delivery & save" : "Confirm discrepancies & save"}
                </button>
              )}
              {!result.fullyVerified && <button className="btn btn-outline" onClick={() => {setStep(1);setError(null);}}>Resolve pending checks <ArrowRight size={16}/></button>}
            </div>
          </div>
        )}

        <div className="mt-12 border-t border-[#e2e7e3] pt-6 text-xs leading-5 text-[#89959c]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2"><FileCheck2 size={15}/> KiranaProof · No automatic claims · No supplier messages</span>
            <span className="inline-flex items-center gap-2"><ClipboardCheck size={15}/> Calculations by deterministic domain rules</span>
          </div>
        </div>
      </div>
    </div>
  );
}
