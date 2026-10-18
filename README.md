# KiranaProof

**Check the whole delivery. Speak the exceptions. Resolve only what is wrong.**

KiranaProof is an invoice-first multilingual delivery reconciliation product for Indian retailers. The product must account for the **complete invoice** before reporting a delivery as reconciled. Clean delivery = no discrepancy claim.

## Current implementation
- Next.js App Router + TypeScript + Tailwind CSS mobile-first product interface.
- [Interactive delivery workbench](/deliveries/new): manual invoice entry; retailer confirmation of complete baseline; received quantities and damage; wrong-item/variant entry; unexpected goods; deterministic comparison.
- Results: `RECONCILED`, `NEEDS_REVIEW`, `HAS_DISCREPANCY`, with affected items and follow-up questions.
- Pure reconciliation domain logic with **26 domain tests** and **8 form tests**.
- GitHub Actions verifies TypeScript, 34 tests and Next.js production build.

**This milestone is a local, in-memory preview**, not persistent delivery confirmation. No supplier claim or message is created. Voice recognition, Supabase Auth/Postgres, secure supplier links and real saved history come in separate reviewed milestones.

## Run locally

Node.js 22.10+:

```bash
npm install
npm run check
npm run dev
```

Open http://localhost:3000 and select **Open reconciliation workbench**. Select **Load sample invoice** for fictional test data.

## Non-negotiable product rules
- Every baseline line must be entered and explicitly confirmed complete.
- Every receipt line must be verified, including identity, quantity, pack size and damage.
- Unexpected goods must be explicitly checked.
- Unknown critical values remain `NEEDS_REVIEW`; never infer a zero.
- Damaged goods are physically received; never double-count as missing.
- The AI will be a suggestion layer, never the reconciliation authority.
- Claim approval and authenticated persistence are separate future operations.

## Roadmap
See [docs/implementation-order.md](docs/implementation-order.md).

## Product specification
[KiranaProof Implementation Blueprint & PRD v1.2](https://docs.google.com/document/d/18PgRI6DVQoKdjv-4Kh51fu59qxJ8yAVe_dKpYMLxomU/edit).

Only synthetic records are used in the demo. Never commit keys, real invoices or audio recordings.
