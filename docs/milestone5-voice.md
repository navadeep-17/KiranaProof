# Milestone 5 — Gnani Prisma voice-first exception entry

## Verified vendor contract
Source: https://docs.gnani.ai/api/STT/speech-to-text
- `POST https://api.vachana.ai/stt/v3` as multipart/form-data
- `X-API-Key-ID` server-side auth header; `audio_file`, `language_code`
- `te-IN` Telugu or `en-IN` Indian English
- Short clips up to 60s (ideal 30s); this MVP deliberately limits recording to 20s.
- WAV is an accepted format. Browser recordings are decoded and resampled to 16kHz mono PCM16 WAV.
- `format=transcribe` plus `itn_native_numerals=false` so numbers are displayed with ASCII digits when supported.
- A normal successful response contains `success:true` and `transcript:string`.

## Safety contract
1. Microphone samples are sent **only** to the Gnani STT endpoint by an authenticated server route, using a private credential in `GNANI_API_KEY`.
2. If `GNANI_MODE` is not `live`, or no key is present, the route returns 503 and the interface offers **manual transcript entry**, not a fake Gnani result.
3. The retailer reads and edits the transcript. Heuristic exception extraction proposes ONE invoice-scoped item/issue/quantity, with an explicit `requires_confirmation` label.
4. Mixed or missing product, units, numeric entities or issue types produce targeted questions. Unspoken invoice lines remain unverified.
5. Copying a suggestion into the receipt does **not** set `verified:true`. The user must still supply/check actual receipt quantity, damage and all other lines before deterministic reconciliation.
6. No audio storage, vendor transcripts or API keys are committed to GitHub or logged in API handlers. No claim, supplier message or status update is created from transcript alone.

## Current scope / limitations
- REST short-turn recording rather than continuous streaming; supported browser microphone and decode capabilities required.
- Transcript extraction uses conservative rules, **not** a trained LLM confidence score. Product matching is deliberately strict to prevent false updates.
- Live Gnani credentials and end-to-end microphone acceptance are still needed. Unit tests use an injected, simulated HTTP response, not a claimed live vendor call.
- No live model latency or accuracy claims; no recording evaluation has been run yet.

## Local acceptance (no deployment)
1. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` in private `.env.local`.
2. When actual Gnani access is authorized, set `GNANI_MODE=live`, `GNANI_API_KEY` in the same private file; keep keys out of chat and commits.
3. Run `npm ci && npm run check && npm run build && npm run test:e2e`.
4. Sign in on `http://localhost:3000`, create a complete invoice baseline and record an exception in Telugu/English.
5. Verify provider returns a real transcript, edit any incorrect words, inspect extraction questions, copy suggestion and check every remaining line.
6. Confirm a clean receipt produces `RECONCILED` with no claim; explicit discrepancies produce the independent claim-approval step.

## Next
Collect 40 labeled Telugu-English test utterances across shortages, damage, wrong variant, unexpected goods and ambiguous numbers. Real voice WER/accuracy must only be reported after live provider evaluation.
