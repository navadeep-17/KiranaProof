# Product hardening: multi-exception review and selected claims

## Voice changes
The workbench accepts several **independently identifiable** shortage/damage clauses in one typed or transcribed utterance. Each must contain the invoice product, a single quantity, unit and issue. Ambiguous or duplicate issue clauses produce clarification; no partial batch is applied. Suggestions stay **unverified** and must be reviewed alongside every invoice line and received condition. Unsupported wrong variants and unbilled goods still require manual editing.

Tests: `tests/voice-multiple.test.ts`, `tests/voice-labeled-cases.test.ts`, `e2e/voice-exceptions.spec.ts`. All synthetic text tests are **not** live Gnani accuracy measurements.

## Claim review changes
After a delivery is confirmed `HAS_DISCREPANCY`, the retailer can choose which verified findings belong in the supplier claim, add optional notes, and must separately approve. The client sends only **finding indexes and notes**. The trusted database function `kp_approve_reviewed_claim` checks owner, status, version, duplicate indexes, and takes issue type, product, unit and quantity solely from the persisted confirmed reconciliation run. A repeated approval returns the same claim without changing items. Notes reach only the scoped claim supplier view. Omitted confirmed issues remain visible in the delivery history but are not included in the claim.

Run `supabase/tests/reviewed-claim-smoke.sql` against the dedicated **development** database with an admin SQL editor. The test is synthetic and explicitly rolls back all records. The normal user roles have no EXECUTE privilege for the approval function; use the Supabase security advisor after changes.

## Acceptance not yet complete
The source branch is stacked on M5 → M4 → M3 draft PRs. Genuine browser authentication and server-side delivery/claim transport are only tested by the opt-in `e2e/live-connected.spec.ts` harness, which still needs a private development account and environment. Actual Gnani audio requires an authorized provider key. Neither should be claimed live-tested based on unit tests or mock HTTP alone. No deployment is planned now.
