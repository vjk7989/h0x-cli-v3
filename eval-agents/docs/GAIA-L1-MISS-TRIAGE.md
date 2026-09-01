# GAIA L1 Miss Triage

Source run: `eval-agents/reports/run-2026-09-01T10-22-08-966Z`

Baseline: `46/53` correct (`86.8%`) on validation Level 1.

This note is intentionally sanitized. It records task IDs, attachment type, observed tool pattern, and failure category only. It does not include raw prompts, raw replies, gold answers, API keys, or full trace payloads.

| Task ID | Attachment | Observed Pattern | Category | Next Action |
|---|---:|---|---|---|
| `e1fc63a2-da7a-432f-be78-7c4a95598703` | none | search, search, reply | web/reasoning | Prefer deterministic calculation and verify the candidate answer before replying. |
| `46719c30-f4c3-4cad-be07-d5cb21eee6bb` | none | search/fetch loop, reply | web/reasoning | Fetch authoritative source pages and verify names before final answer. |
| `65afbc8a-89ca-4ad5-8d62-355bb401f61d` | `.xlsx` | reply only | spreadsheet evidence skipped | Make attachment evidence mandatory and surface workbook path candidates before the question. |
| `e142056d-56ab-4352-b091-b56054bd1359` | none | shell, shell, reply | reasoning/calculation | Require deterministic calculation and final candidate verification. |
| `7673d772-ef80-4f0f-a602-1bf4485c9b43` | none | search/fetch with loop warning, reply | web/reasoning | Use at least one authoritative fetched page and stop broad searching once evidence is sufficient. |
| `c365c1c7-a3db-4d5e-a9a1-66f56eae7865` | none | search, search, search, reply | web/reasoning | Verify the candidate list against authoritative source pages before final answer. |

The image/chess miss `cca530fc-4052-43b2-b130-b30968d8aa44` is excluded from this pass by request.
