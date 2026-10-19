# Draft recovery and confirmation — Milestone 3

## Product behavior
A delivery may be saved even when **not every invoice line is entered or checked**. A saved incomplete delivery has status `NEEDS_REVIEW`; it is **not reconciled**, and no claim exists. From the dashboard, the retailer can choose **Resume** to edit its baseline, received quantities, condition and unexpected goods. A fresh confirmation is possible only after the server recomputes a fully verified result.

## Server rules
- The initial save uses `kp_save_delivery` to persist owner, supplier, invoice lines, receipt lines and an audit entry atomically; retries use a request id.
- `PUT /api/v1/deliveries/:id` checks signed-in ownership and expected version, then calls `kp_update_delivery` under a database row lock.
- Edits are permitted only in `DRAFT` or `NEEDS_REVIEW`. Confirmed `RECONCILED` and `HAS_DISCREPANCY` deliveries cannot be changed in this milestone.
- Saving a changed draft bumps its version and leaves it `NEEDS_REVIEW`. Any client preview is advisory.
- Confirmation runs the **deterministic engine** over database rows and requires the exact version inside the confirmation transaction. It saves immutable findings and an audit event.
- The store name shown on a resumed draft is read-only. Store profile editing belongs in a dedicated settings workflow.

## Smoke tests
1. Run `npm ci && npm run check && npm run build` on Node 22.10+.
2. In the dedicated development database SQL editor, use `supabase/tests/draft-lifecycle-smoke.sql` for a **rollback-only** test of pending draft saves, resume updates, idempotency, stale-version and cross-owner rejection, clean finalization and prohibition of post-confirmation edits.
3. Check RLS advisors and function grants after migrations.
4. Still outstanding: a real browser sign-up/login -> save incomplete draft -> resume -> confirm -> detail walkthrough using a private local environment.

**Do not deploy just to run these tests.** Local runtime configuration and an integration-test session are sufficient.
