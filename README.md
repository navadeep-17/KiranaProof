# KiranaProof

**Voice-first delivery reconciliation and discrepancy resolution for Indian retailers.**

KiranaProof compares an entire invoice/order with what actually arrived. A fully verified, correct delivery is marked **RECONCILED** with **no discrepancy claim**. Missing, damaged, wrong, or extra goods are reviewed before a shopkeeper approves a claim; ambiguous deliveries stay **NEEDS_REVIEW**.

Development is organized through small, reviewed GitHub pull requests. Our first vertical slice implements deterministic line-by-line reconciliation with automated tests, before adding voice AI.

Project specification: [PRD v1.2 (editable source)](https://docs.google.com/document/d/18PgRI6DVQoKdjv-4Kh51fu59qxJ8yAVe_dKpYMLxomU/edit).

> Status: active development. Demo fixtures are synthetic. No automated claims, payments, or supplier messages.
