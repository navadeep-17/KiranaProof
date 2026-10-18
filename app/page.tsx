import Link from "next/link";
import { ArrowRight, Boxes, CheckCircle2, ClipboardCheck, FileSearch2, MessagesSquare, ShieldCheck, Sparkles, Volume2 } from "lucide-react";

const steps = [
  { number: "01", title: "Capture the invoice", text: "Enter the complete bill or order, including variants and pack units.", icon: FileSearch2 },
  { number: "02", title: "Verify what arrived", text: "Check items individually or describe exceptions. Every line still needs confirmation.", icon: ClipboardCheck },
  { number: "03", title: "Resolve only exceptions", text: "A clean delivery needs no claim. Only reviewed discrepancies move forward.", icon: MessagesSquare },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f7f7f2]">
      <div className="border-b border-[#e5e8e6] bg-white/90">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-3 font-bold tracking-[-.04em] text-[#142337]">
            <span className="brand-mark"><Boxes size={22} strokeWidth={2.2} /></span>
            <span className="text-[21px]">Kirana<span className="text-[#d46b2b]">Proof</span></span>
          </Link>
          <Link href="/deliveries/new" className="btn btn-primary !min-h-10">
            Try workbench <ArrowRight size={16} />
          </Link>
        </nav>
      </div>
      <main>
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-17 md:grid-cols-[1.1fr_.9fr] md:pb-22 md:pt-24">
          <section>
            <span className="kicker inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#d46b2b]" /> A more reliable way to receive goods</span>
            <h1 className="mt-5 max-w-2xl text-[clamp(2.9rem,5.7vw,4.9rem)] leading-[1.065] font-[760] tracking-[-.065em] text-[#142337]">
              Every delivery deserves a <span className="text-[#b96535]">proper check.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-[1.75] text-[#5b6d7c]">
              KiranaProof compares the whole invoice against the goods received. If everything matches, it records a clean delivery. If something is missing, damaged, or wrong, it helps you document only that exception.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/deliveries/new" className="btn btn-accent !px-6 !py-3.5">Open reconciliation workbench <ArrowRight size={17}/></Link>
              <span className="text-xs text-[#788693]">Interactive milestone · sample data available</span>
            </div>
            <div className="mt-11 flex flex-wrap items-center gap-6 text-[12px] font-semibold text-[#5d716f]">
              <span className="inline-flex items-center gap-2"><ShieldCheck size={17} className="text-[#23695b]" /> Explicit confirmation</span>
              <span className="inline-flex items-center gap-2"><ClipboardCheck size={17} className="text-[#23695b]" /> Full-line reconciliation</span>
              <span className="inline-flex items-center gap-2"><Volume2 size={17} className="text-[#23695b]" /> Voice interface planned</span>
            </div>
          </section>
          <section className="relative" aria-label="Illustrative reconciliation result">
            <div className="absolute -inset-6 rounded-[40px] bg-[radial-gradient(ellipse_at_center,#dce8dd_0%,transparent_65%)]" />
            <div className="surface relative overflow-hidden rounded-[24px]">
              <div className="flex items-center justify-between border-b border-[#eef0ed] px-6 py-5">
                <div><div className="text-xs font-semibold text-[#83918b]">DELIVERY REVIEW</div><div className="mt-1 font-bold text-[#263949]">Invoice #INV-1208</div></div>
                <span className="rounded-full bg-[#ecf6ee] px-3 py-1.5 text-xs font-semibold text-[#236646]">Reconciled</span>
              </div>
              <div className="space-y-5 px-6 py-6">
                {[
                  ["Parle-G", "12 cartons", "12 cartons"],
                  ["Lux Soap", "8 boxes", "8 boxes"],
                  ["Surf Excel", "10 packs", "10 packs"],
                ].map(([name, expected, received]) => (
                  <div key={name} className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#eaf4ef] text-[#246747]"><CheckCircle2 size={19}/></div>
                    <div className="flex-1"><div className="text-sm font-bold text-[#263949]">{name}</div><div className="text-xs text-[#80909a]">Billed: {expected}</div></div>
                    <div className="text-right text-sm font-semibold text-[#2b6b55]">{received}<div className="text-[11px] font-normal text-[#80909a]">Received</div></div>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#e7ede8] bg-[#f5faf6] px-6 py-5">
                <div className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-[#2c7d59]" size={22}/><div><div className="text-sm font-bold text-[#25563c]">All 3 invoice lines verified</div><div className="mt-1 text-xs text-[#688172]">No shortages, damage, wrong items, or unexpected goods.</div><div className="mt-3 inline-flex rounded-md bg-white px-2.5 py-1.5 text-xs font-bold text-[#286547]">No claim needed</div></div></div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-5 hidden items-center gap-2 rounded-xl bg-[#172a3b] px-4 py-3 text-xs font-semibold text-white shadow-xl sm:flex">
              <Sparkles size={16} className="text-[#eda679]" /> Intelligence that knows when not to act
            </div>
          </section>
        </div>
        <section className="border-t border-[#e2e7e2] bg-white py-17">
          <div className="mx-auto max-w-6xl px-5">
            <div className="mb-9"><p className="kicker">Purpose-built for deliveries</p><h2 className="mt-3 text-3xl font-[750] tracking-[-.045em]">Check first. Report only when necessary.</h2></div>
            <div className="grid gap-4 md:grid-cols-3">
              {steps.map((step) => <div key={step.number} className="rounded-2xl border border-[#e6e9e5] p-6">
                <div className="mb-8 flex items-center justify-between"><span className="text-sm font-bold text-[#c37946]">{step.number}</span><step.icon size={21} className="text-[#3d6960]"/></div>
                <h3 className="text-lg font-bold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#6b7a82]">{step.text}</p>
              </div>)}
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-[#e6e9e5] px-5 py-7 text-center text-xs text-[#8c969c]">
        KiranaProof · Working prototype · Fictional demonstration invoices · No supplier messages are sent
      </footer>
    </div>
  );
}
