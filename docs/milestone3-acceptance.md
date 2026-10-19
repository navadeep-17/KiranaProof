# Milestone 3 acceptance checks (without deployment)

## Automated, no live accounts
- `npm ci`, `npm run check`, `npm run build`.
- `npm run test:e2e`: Playwright tests run against localhost with Chromium desktop and mobile emulation.
- Browser cases: fully checked clean delivery (no claim), incomplete receipt (NEEDS_REVIEW), shortage (HAS_DISCREPANCY).
- Cross-origin and incorrect Content-Type request guards; write-replay policy tests.
- Supabase SQL editor: `supabase/tests/draft-lifecycle-smoke.sql` and `supabase/tests/rls-isolation-smoke.sql`, both fully rolled back.
- Supabase security advisor: zero findings.

## Still required: authenticated real-browser journey
Using private `.env.local` and a development-only authenticated test account:

1. Open `http://localhost:3000/login` and sign in. Confirm dashboard loads and no other store appears.
2. Open workbench, enter partial invoice, save incomplete draft. See NEEDS_REVIEW in dashboard.
3. Click Resume, finish entire invoice and all receipt checks. Save again, then compare and confirm.
4. Verify confirmed clean delivery shows RECONCILED and no discrepancy claims.
5. Repeat with 2-unit shortage and 1 damaged received item. Verify findings persist after navigation.
6. Interrupt a save response (browser network throttling/offline) and retry; check that a duplicate wasn't created.
7. Open another store account; ensure the first account's delivery URL is unreadable.
8. Check details, loading states and tap targets in desktop and mobile browsers.

**Do not commit keys, screenshots of session cookies, or customer data.** Never provide the server secret to a browser. Live provider verification is **not yet passed**, and passing mockable UI tests does not prove it.

## Release decision
Keep Milestone 3 draft until the authenticated localhost path is checked. No Vercel deployment is required or planned in this milestone.
