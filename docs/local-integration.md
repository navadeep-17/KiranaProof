# Private local integration test — prerequisites and execution

The mocked browser tests and transaction-level SQL smokes do **not** prove the actual
browser-cookie-authenticated Next.js → Supabase flow or supplier access. The new
`e2e/live-connected.spec.ts` exercises it without mocks, gated by explicit
environment flags.

## Before running
- Use a **development-only** Supabase project and a dedicated real test account.
- Set public Supabase URL/key and server-only Supabase secret in local `.env.local`.
- Confirm the account has a verified email or that the development project supports it.
- **Never paste or commit secret values**. Set `KP_TEST_EMAIL` and `KP_TEST_PASSWORD`
  privately in your terminal or a local untracked environment.
- This will create synthetic store/delivery/claim entries, unlike the rollback SQL checks.
  Plan manual cleanup or use a disposable development project. Do not run on production.

## Commands
```sh
npm ci
npx playwright install chromium
# Start with private environment values loaded by Next.js from .env.local.
# Set three runner environment variables in the shell:
# KIRANAPROOF_LIVE_E2E=1
# KP_TEST_EMAIL=<your-development-test-email>
# KP_TEST_PASSWORD=<your-development-test-password>
npm run test:e2e -- --project="Desktop Chrome" e2e/live-connected.spec.ts
```

The test signs in, saves an incomplete invoice, resumes it, confirms a shortage,
approves a claim, generates a supplier link, replies from an unauthenticated browser
context, then records the retailer resolution.

## Remaining until actually executed
- No private development account/password or local Supabase secret is available
  to the current GitHub-only implementation session.
- This scenario is **not** in normal CI and must not be described as passed
  until run with real local credentials.
- The Gnani live-STT key is separate and optional for this integration test.
