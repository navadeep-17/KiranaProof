# KiranaProof — prelaunch acceptance ledger

This ledger separates code implementation from verified behavior. **A green unit test is not proof of a signed-in browser/API/provider connection.** No deployment or production sign-off is implied.

| Gate | Evidence / action | Current state |
| --- | --- | --- |
| Deterministic invoice-first comparison | Core engine and browser cases for clean, shortage and partial receipts | Automated |
| No silent correctness | Baseline completeness, each invoice receipt and unexpected-goods checks | Automated |
| Damage quantity belongs to received | Domain tests and reviewed-claim SQL checks | Automated |
| Explicit claim approval | Owner-scoped server function; selected confirmed issues; notes and audit | SQL + code |
| Supplier response scope | 256-bit expiring bearer URL; one reply; owner final resolution | SQL + code |
| Cross-account isolation | RLS and rollback-only DB tests | SQL |
| Oversized uploads | Measured streamed body cap for JSON writes, supplier reply and voice multipart | Automated |
| Supplier link hostname | Configured `APP_PUBLIC_ORIGIN`; fail closed in production | Automated |
| Accessible keyboard workflow | Keyboard smoke and checked form controls; real-device manual audit still needed | Partial |
| Telugu supplier reply UI | Language toggle and translated form copy; rest of dashboard is English | Partial |
| Real authenticated persistence | `e2e/live-connected.spec.ts` with private dev credentials | **Pending** |
| Real Gnani transcription | Provider key + labeled spoken clips in Telugu/Indian English | **Pending** |
| Mobile device quality | At least Android Chrome and iPhone Safari recording and review | **Pending** |
| Abuse protection at ingress | Configure platform/IP rate limits, monitoring and quota for token and STT endpoints | **Release gate** |
| Privacy/log retention | Check hosting logs do not retain supplier bearer paths, raw audio or private payloads | **Release gate** |
| Secret handling | Only server-side `SUPABASE_SECRET_KEY`, `GNANI_API_KEY`, `APP_PUBLIC_ORIGIN` configured | **Release gate** |
| Restore and incidents | Backup/restore test, environment isolation, audit access and incident runbook | **Release gate** |

## Development acceptance

On Node.js 22.10+:

```sh
npm ci
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
```

Run `supabase/tests/*.sql` one at a time against **development Supabase only**; all committed smokes end in `rollback;`. Never use a real customer's data. Keep `APP_PUBLIC_ORIGIN` set to the intended trusted `https://` base before using supplier links in a production runtime.

## Release block conditions

Do not deploy, claim full multilingual UI support, report live model accuracy or merge stacked PRs solely because these automated checks pass. A real signed-in browser save/resume/confirm, a separate no-login supplier reply and a real microphone/provider test must pass first. Do not claim distributed rate-limiting or privacy-safe platform logs have been configured; those depend on the future hosting environment.
