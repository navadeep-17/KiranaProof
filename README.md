# KiranaProof

**Check the whole delivery. Speak the exceptions. Resolve only what is wrong.**

KiranaProof is an invoice-first, multilingual delivery reconciliation and supplier-discrepancy product for Indian retailers. Unlike a voice complaint generator, it accounts for every invoice line before making a delivery decision.

**Rule:** All invoice lines verified, correct product/variant/unit/quantity, zero damage, and no unexpected items → `RECONCILED` and **no claim**. A confirmed mismatch → `HAS_DISCREPANCY`; an ambiguous or incomplete comparison → `NEEDS_REVIEW`. Supplier claims require later explicit approval and are not automatically created.

## Current implementation (Milestone 1)
- Pure TypeScript reconciliation engine in `lib/reconciliation/engine.ts`.
- Structured invoice/receipt types and fictional data fixtures.
- Distinct shortages, excess, damage, wrong item/variant and unexpected items.
- Conservative review state for missing line checks, unknown condition and mismatched units.
- 26 focused Node test cases and GitHub Actions check workflow.
- Explicit full-invoice completeness confirmation: matching only the entered subset is never enough.

**Not built yet:** Next.js UI, persistence, authentication, Gnani live STT, claims, share links and supplier response. The engine only *evaluates* structured inputs and never persists a delivery or creates a claim.

## Development
Node.js 22.10+:
```bash
npm install
npm run check
```

## Next milestones
See [docs/implementation-order.md](docs/implementation-order.md).

## Specification
The product contract is [KiranaProof PRD v1.2](https://docs.google.com/document/d/18PgRI6DVQoKdjv-4Kh51fu59qxJ8yAVe_dKpYMLxomU/edit). Both clean and discrepant deliveries must work correctly before voice or supplier workflows can ship.

Development is organized in reviewable GitHub pull requests. Do not push credentials, raw customer documents or recordings.
