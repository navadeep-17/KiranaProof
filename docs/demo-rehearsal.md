# KiranaProof — rehearsal runbook (development only)

Purpose: demonstrate **whole-invoice verification**, **no claim on a clean delivery**, explicit discrepancy approval, private supplier response, and retailer-only resolution. Use **synthetic** invoice and store names. Do not show any service key, cookie, bearer-link token in a public recording, or claim actual Gnani model accuracy before live provider testing.

## Demo order (approximately 4 minutes when the live stack has been verified)

1. **Problem and baseline (0:00–0:35).** A kirana shop checks an incoming invoice line by line. A spoken statement about missing goods does not prove that other goods arrived correctly. Open the mobile-width delivery workbench; load the synthetic three-item sample invoice. Show the invoice-completeness confirmation.
2. **Voice suggestion, not evidence (0:35–1:10).** In the voice panel, enter `Parle G 2 cartons missing and Lux Soap 1 box damaged` as a **typed transcript fallback**. Analyze it. Show two separate proposed changes; copy them one at a time. Point out both product verification checkboxes remain unchecked. Actual Gnani microphone transcription must be demonstrated only when a real provider key works.
3. **Complete verification, not assumption (1:10–2:00).** Mark all **remaining lines** explicitly correct after reviewing received quantities and condition. Confirm the check for unbilled goods. Run deterministic reconciliation and show a verified shortage/damage discrepancy. Don't claim the wrong item or unexpected-goods case was voice-parsed; those require manual entry.
4. **Retailer-approved claim (2:00–2:40).** Confirm and save the discrepancy delivery to the authenticated development database. In delivery details, select which confirmed findings to include in the supplier claim; attach a supplier note. Click the separate approval checkbox. Emphasize that no notification has been sent automatically.
5. **Supplier responds, retailer resolves (2:40–3:30).** Create a short-lived supplier link; open it in a separate **signed-out** browser context. Choose the Telugu response form if desired. Submit one reply. After returning to the retailer account, show the supplier reply and manually record replacement or credit. Mention expiry/revocation and no supplier access to full store records.
6. **Clean receipt (3:30–4:00).** Demonstrate a fresh sample invoice with all received quantities/conditions verified and no unexpected goods. It must reach `RECONCILED` with **zero claims** and no supplier link or message.

## Without private development credentials

The dashboard persistence and supplier link steps above **cannot** be honestly claimed as live-tested. Rehearse the invoice and voice portions locally using the no-login workbench; describe claim/supplier flow using code and tests instead of fabricated records. Do not expose a fake provider transcript as real Gnani STT.

## Evidence to collect before submission

- A screen recording of a genuinely tested signed-in browser flow, with synthetic data only.
- Two-browser retailer/supplier test result, links revoked after use and no raw bearer token in recording.
- Screenshot or saved CI link for typecheck, unit, browser and production-build checks.
- A voice evaluation table with actual recorded utterances, ground-truth transcripts and observed provider output, **only if live Gnani access becomes available**.
- A short limitations slide: short-turn Telugu/Indian English, retailer verifies every invoice line, no OCR/automatic messaging and no inflated AI accuracy claim.

## Rehearsal blockers

- A private Supabase development account/server secret and real browser acceptance still must be configured and run using `docs/local-integration.md`.
- Live Gnani microphone STT requires authorized `GNANI_API_KEY`.
- Public deployment, credentials, release monitoring and upstream PR merges remain deferred by product decision.
