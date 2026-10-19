# KiranaProof

**Check the whole delivery. Speak the exceptions. Resolve only what is wrong.**

KiranaProof is an invoice-first, multilingual delivery reconciliation and discrepancy-resolution product for Indian retailers. Every invoice/order line is accounted for before reconciliation. A fully verified clean delivery is **RECONCILED** with **no claim**; unknown inputs remain **NEEDS_REVIEW**.

## Implementation status

### Delivery and reconciliation (Milestones 1–3)
- Next.js App Router + TypeScript + Tailwind responsive workbench.
- Invoice baseline, received quantities, damage, unexpected goods, manual checks and deterministic reconciliation.
- Supabase Auth and private retailer dashboard, atomic/idempotent draft saves, version-checked edits/resume, saved comparison and explicit confirmation.
- Server recomputes findings from persisted rows. No LLM can authorize claims or decide arithmetic.

### Approved claims and supplier response (Milestone 4 — development branch)
- Retailer reviews confirmed discrepancies and separately **approves** a claim. No claim is generated for clean or incomplete deliveries.
- A claim contains only affected items. Duplicate approval returns the same claim.
- Retailer generates a **256-bit expiring supplier link** and copies it manually. No messages are sent.
- Supplier opens the scoped link without retailer login, views only relevant discrepancies and can respond **once**.
- Links are stored as SHA-256 hashes, can expire, rotate, or be revoked immediately.
- Retailer alone records the final outcome (replacement, credit, or other); supplier cannot mark a claim settled.
- Store-level RLS, server-only mutation RPCs, restrictive API-origin policy and audit events.

### Voice-assisted exception entry (Milestone 5 — development branch)
- An authenticated Next.js endpoint for **real Gnani Prisma REST STT**, with server-only `X-API-Key-ID` and support for Telugu (`te-IN`) or Indian English (`en-IN`).
- Microphone capture (up to 20 seconds), resampling to 16 kHz mono PCM WAV, editable transcript and typed fallback.
- Conservative invoice-scoped shortage/damage proposals; ambiguous values, wrong items/variants or unbilled goods trigger clarification/manual handling.
- **Voice can only populate unverified receipt fields**. Every remaining item, unit and damage status must be checked by the retailer.
- When `GNANI_MODE` is not `live` or `GNANI_API_KEY` is absent, transcription returns a clear unavailable message. It does not fake speech recognition.
- Tests include the documented multipart Gnani protocol using a simulated HTTP transport and **40 synthetic Telugu-English extraction fixtures**. These are not real audio or vendor-accuracy benchmarks.

**Not yet implemented:** verified live Gnani transcription with real credentials, OCR, automatic messaging, and public deployment. Real browser authentication → Supabase integration acceptance is still pending.

## Branch and PR workflow

- Milestone 3: [PR #7](https://github.com/navadeep-17/KiranaProof/pull/7), still a draft pending real signed-in localhost integration.
- Milestone 4: [PR #8](https://github.com/navadeep-17/KiranaProof/pull/8), stacked on the M3 feature branch rather than main; **do not merge until M3 is verified**.
- Milestone 5: [PR #9](https://github.com/navadeep-17/KiranaProof/pull/9), stacked on M4; genuine Gnani adapter, audio capture and conservative extraction. Live Gnani credentials have not been provided.
- None of these PRs constitutes public deployment or a verified production-grade voice pipeline.

## Run locally

Requires Node.js 22.10+.

```bash
npm ci
cp .env.example .env.local
# Configure your own private development environment values in .env.local
npm run check
npm run dev
```

Public Supabase URL and publishable key may be used by the browser; `SUPABASE_SECRET_KEY` is strictly backend-only. Never commit credentials or share a server secret in chat. Live login needs a locally configured Supabase project and appropriate Auth redirect settings.

For CI-style tests:

```bash
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
```

Ordinary Playwright browser tests mock selected save API responses and do **not** establish a live signed-in Supabase workflow. The opt-in `e2e/live-connected.spec.ts` uses **real** Supabase Auth, delivery APIs, supplier link and response without mocks. See [local integration instructions](docs/local-integration.md) for the private development account and environment requirements. This live test is disabled in normal CI.

## Critical product rules

- Complete invoice/order baseline must be confirmed.
- No item is silently assumed delivered: every line, received count and condition must be verified.
- Unknown quantities are `null`, not `0`; pack units are not silently converted.
- Damaged quantity is physically received and not counted again as missing.
- Incomplete or ambiguous deliveries stay `NEEDS_REVIEW`.
- A verified clean delivery creates **zero claims and zero supplier actions**.
- A discrepancy requires explicit retailer claim approval; supplier links require separate explicit sharing.
- The supplier's reply does not prove replacement/payment; only the retailer records resolution.

## Verification and specifications

- GitHub CI on the M5 branch covers reconciliation, supplier claims, voice parsing, audio/protocol handling and desktop/mobile browser tests. Check the latest GitHub Actions run for the actual totals.
- Database: `supabase/tests/draft-lifecycle-smoke.sql`, `supabase/tests/rls-isolation-smoke.sql`, `supabase/tests/claim-lifecycle-smoke.sql` — admin-only, synthetic and entirely rolled back.
- [Milestone 3 acceptance checklist](docs/milestone3-acceptance.md)
- [Milestone 4 acceptance checklist](docs/milestone4-acceptance.md)
- [Milestone 5 voice integration](docs/milestone5-voice.md)
- [Local real-auth integration](docs/local-integration.md)
- [KiranaProof PRD v1.2](https://docs.google.com/document/d/18PgRI6DVQoKdjv-4Kh51fu59qxJ8yAVe_dKpYMLxomU/edit)

Development priority: finish real localhost authentication and claim-flow acceptance, obtain Gnani credentials privately for actual voice verification, evaluate voice errors and clarify edge cases, then release hardening. **Deployment stays deferred.**
