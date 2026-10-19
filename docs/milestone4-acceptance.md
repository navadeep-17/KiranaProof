# Milestone 4 — Approved claim and supplier response acceptance

## Source of truth
- **Never** generate a claim for RECONCILED or NEEDS_REVIEW.
- A confirmed `HAS_DISCREPANCY` delivery exposes the affected lines. The retailer must review and tick an explicit approval box before creating a claim.
- Exactly one claim per delivery. Repeated approval must return the original claim; never duplicate it.
- No automatic WhatsApp, SMS, email or supplier notification.
- Supplier links are **256-bit random**, stored as SHA-256 hashes only, expire in 1–7 days and are explicitly revocable. Generating a replacement link rotates the secret and invalidates the old link.
- Supplier sees only invoice reference, intended supplier name and affected items. It cannot browse store history or resolve a claim.
- One successful response is accepted per claim; responding invalidates the link.
- Only the retailer can record final resolution (replacement, credit, or other), with notes.

## Verify
1. `npm ci && npm run check && npm run build && npm run test:e2e` — no public deployment needed.
2. Run the committed `supabase/tests/claim-lifecycle-smoke.sql` in the dedicated development database SQL editor. It uses synthetic data in a transaction and rolls back everything.
3. Supabase security advisor should have no findings. RLS owner reads apply to claims, items and supplier replies; link hashes are never browser-readable.
4. Inspect server APIs for authentication on approval/share/revoke/resolve, same-origin JSON guards, token validation and generic error handling.

## Pending integration acceptance
Live signed-in browser tests require private local Supabase environment configuration (the same unresolved gate as PR #7). Until then, unit/CI checks and SQL smoke are not evidence of a real HTTP+Auth+DB round trip.

## Stacked development
PR #8 targets `feat/authenticated-deliveries` until PR #7 is verified and merged. Do not deploy or claim end-to-end supplier delivery until real local verification passes.
