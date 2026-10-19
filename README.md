# KiranaProof

**Check the whole delivery. Speak the exceptions. Resolve only what is wrong.**

KiranaProof is an invoice-first, multilingual delivery reconciliation and discrepancy resolution platform. Every invoice line must be accounted for. Fully verified clean deliveries need **no claim**; incomplete verification remains **NEEDS_REVIEW**.

## Implemented

- Mobile-first Next.js + TypeScript + Tailwind landing page and delivery workbench.
- Structured invoice and receipt entry, explicit baseline/condition/extras confirmations, missing/damaged/wrong/excess detection.
- Deterministic reconciliation engine; AI is not allowed to determine final business status.
- Supabase Auth sign-up/sign-in, per-store private dashboard and sign-out.
- Store, supplier, delivery, invoice, receipt, reconciliation-run and audit-event tables, all RLS protected.
- Server-only **atomic delivery save**, idempotent request ID, **version-checked reconciliation confirmation**, and owner-scoped saved delivery views.
- Clean delivery → saved `RECONCILED`, with **zero discrepancy claim**. A verified mismatch → saved `HAS_DISCREPANCY` (no supplier action yet).
- Automated TypeScript/test/build CI (39 tests currently passing).

**Limitations:** There is no voice AI, claim sharing, supplier workflow, OCR, editing of saved drafts or automatic messaging yet. Live browser authentication/persistence awaits deployment configuration and a manual end-to-end walkthrough. GitHub CI does not itself prove a live Supabase session works.

## Run locally

Node.js 22.10+ required.

```bash
npm install
cp .env.example .env.local
# Set your public Supabase URL, publishable key, and server-side secret key in .env.local
npm run check
npm run dev
```

Open http://localhost:3000, sign up or sign in, and choose **Open reconciliation workbench**. Use **Load sample invoice** for synthetic test data, explicitly confirm the complete invoice, verify every receipt line, review the result and click **Confirm & save**.

### Configuration

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SECRET_KEY=<secret-backend-key>
```

Never commit real keys or credentials, add secret keys to `NEXT_PUBLIC_` variables, or paste them into issues. Configure them in `.env.local` and your deployment provider's protected environment-variable settings. Auth email confirmation/redirect URL should be configured for the final deployment.

## Security architecture

- Browser uses Supabase publishable key for authentication and SELECT protected by RLS.
- All writes are through authenticated Next.js Route Handlers using server-only credentials.
- Write RPCs are callable **only** by the service role and check the verified owner ID supplied by the server.
- Confirmation recalculates status from saved invoice and receipt rows (not from a browser-supplied result).
- The database checks version and basic clean-reconciliation invariants in the same transaction.
- Supplier links and claims are intentionally not present until the next milestone.

## Test and roadmap

```bash
npm run check
npm run build
```

See [implementation order](docs/implementation-order.md) and [backend security contract](docs/backend-security.md).

**Not yet release-ready:** a configured deployment, one real authenticated end-to-end save/reconcile smoke test and a dependency lockfile are outstanding. No accuracy claims about Gnani have been made.

Product specification: [KiranaProof PRD v1.2](https://docs.google.com/document/d/18PgRI6DVQoKdjv-4Kh51fu59qxJ8yAVe_dKpYMLxomU/edit).
