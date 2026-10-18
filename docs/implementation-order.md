# KiranaProof — Implementation order

## Product invariant
A complete, explicitly verified invoice comparison is a precondition for `RECONCILED`. If the full receipt is clean, **no discrepancy claim is created**. If anything is uncertain, remain `NEEDS_REVIEW` (even when confirmed issues on other lines exist).

## Milestones
1. **Reconciliation domain core (this PR):** pure deterministic engine, separate shortage vs damage, variants/units, ambiguity rules, fixtures and tests.
2. **Application shell:** Next.js mobile UI, invoice editing, receipt checklist, results and review. No fabricated server persistence.
3. **Data and security:** Supabase Auth, tables, RLS, tenant isolation, durable deliveries and confirmation transactions. State transitions must not trust client-supplied result.
4. **Claim and supplier workflow:** affected lines only, explicit owner approval, hashed expiry/revocable bearer links, scoped reply, audit timeline.
5. **Gnani voice:** microphone PCM16 WAV, Prisma adapter with mock/live modes, structured interpretation constrained to invoice, clarification, read-back.
6. **Hardening:** cross-tenant and public token security tests, 36+ labeled cases, mobile walkthrough, Vercel preview/production and submission demo.

## In milestone 1
- Test with `npm install && npm run check` on Node.js 22+.
- `reconcile()` is pure; its result is *eligibility*, not an approved database state.
- The UI, persistence, live provider integration, claims and supplier responses are **not yet implemented**.
- The fixtures use fictional transactions; they are not proof of live voice accuracy.
- Critical source values are not silently inferred. Unknown quantities are `null`, not `0`.

## Upcoming engineering decisions
- Add an authoritative backend confirmation gate bound to delivery version.
- Validate payloads at API boundaries; malformed inputs fail closed.
- Decide an auditable structured representation for blanket confirmation of remaining invoice lines.
- Introduce decimal quantities consistently between Postgres and TypeScript.
- Align future API names with one versioned contract; do not create both /api/v1 and unversioned endpoints ad hoc.

## Collaboration
Every milestone is a feature branch and reviewed pull request. Do not commit API keys or actual shop/customer private data. Run CI before merge and keep main deployable.
