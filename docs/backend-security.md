# Milestone 3 — Backend and security contract

## Dedicated database
Project: KiranaProof, region ap-south-1. Git-tracked migration: `20261019034211_initial_delivery_core.sql`. Project credentials are configured via deployment environment; never commit secrets.

## Server/client responsibilities
- Browser Supabase client uses **publishable key** solely for login/signup and permitted SELECT operations.
- Next.js server authenticates with `auth.getUser()` or verified `getClaims()` and uses cookie-aware SSR.
- All seven tables expose owner-scoped **SELECT** only to authenticated users. No direct anonymous reads or authenticated writes.
- Future draft-save and confirmation routes will use server-only credentials. Every mutation must verify account ownership, supplier/delivery membership, and expected delivery version.
- Reconciliation findings are recomputed by the server, not accepted from a browser-supplied status field.
- No delivery is marked RECONCILED without a confirmed complete invoice and all verified lines.
- No claim exists in this schema. Claims, supplier links, and supplier responses are Milestone 4.

## Migration result (2026-10-19)
- Applied successfully to dedicated KiranaProof database.
- Public tables: stores, suppliers, deliveries, invoice_lines, receipt_lines, reconciliation_runs, audit_events.
- All tables RLS enabled; Supabase security advisor returned **no lints**.
- The database is empty; no fake user authentication or delivery success has been fabricated.

## Notes
- Next steps: authenticated store onboarding, atomic draft save (single transaction), versioned confirmation with audit events, and RLS integration tests.
- Never use SUPABASE_SECRET_KEY in a `NEXT_PUBLIC_` environment variable.
- Do not assume successful CI build tests a live database connection.
