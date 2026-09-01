# GAIA Pilot Handoff

## Current State

The h0x GAIA pilot harness is implemented. It can run `h0x-cli` through OpenRouter, Gemini, NVIDIA NIM, or Azure OpenAI and stores reports under `eval-agents/reports/`. The committed fixture smoke run passed through the real agent loop and OpenRouter, and leaderboard-readiness tooling includes guarded official test execution and submission JSONL export/validation.

Gemini eval support is available with `H0X_CLI_GAIA_PROVIDER=gemini` and `GEMINI_API_KEY`. The best clean Gemini pilot so far is 4/5 (80.0%) on 5 Level 1 validation tasks using `gemini-3.5-flash-lite` and `H0X_CLI_GAIA_CASE_DELAY_MS=30000`. The first full Level 1 validation run scored 27/53 (50.9%) with 5 max-step failures and no provider rate-limit failures. A fresh full Level 1 rerun after harness fixes scored 30/53 (56.6%) with no max-step or provider-rate-limit rows, but 9 rows still carried `process_exit` infrastructure markers. The process-exit issue is now cleared by eval lifecycle hardening; Gemini is currently blocked by `429` provider rate limiting during fresh full reruns.

Azure OpenAI eval support is now the strongest local path tested so far. Use `H0X_CLI_GAIA_PROVIDER=azure`, `AZURE_OPENAI_API_KEY`, and model/deployment `gpt56testsolv2`. The adapter seeds an OpenAI-compatible provider at the user-provided Azure base URL and sets Azure-specific request shape: `max_completion_tokens` plus no `temperature`. A 5-row Azure Level 1 pilot scored 5/5. After targeted retries and an eval-only finalization safety net, a final fresh uninterrupted Azure full Level 1 run completed all 53 rows cleanly and scored 46/53 (86.8%).

Reference the decision record at `eval-agents/docs/GAIA-PILOT-DECISIONS.md`, smoke report directory `eval-agents/reports/run-2026-08-31T21-00-16-706Z`, and GAIA validation pilot report directory `eval-agents/reports/run-2026-08-31T21-15-01-980Z`.
The current full scored Gemini Level 1 report is `eval-agents/reports/run-2026-09-01T01-04-52-757Z`. The clean 9-row process-exit gate is `eval-agents/reports/run-2026-09-01T03-18-21-958Z`. The latest partial Gemini full rerun, stopped for provider rate limiting, is `eval-agents/reports/run-2026-09-01T03-28-09-786Z`. The Azure 5-row pilot is `eval-agents/reports/run-2026-09-01T04-59-36-205Z`; Azure partial full is `eval-agents/reports/run-2026-09-01T05-01-51-246Z`; Azure targeted completion rerun is `eval-agents/reports/run-2026-09-01T06-58-03-030Z`; isolated final-row success is `eval-agents/reports/run-2026-09-01T09-43-18-522Z`; older full Azure run with one max-step row is `eval-agents/reports/run-2026-09-01T09-45-39-974Z`; clean final full Azure run is `eval-agents/reports/run-2026-09-01T10-22-08-966Z`.

## Latest Result

Fresh full GAIA validation Level 1 score is now the clean Azure run at 46/53, 86.8%, from `eval-agents/reports/run-2026-09-01T10-22-08-966Z`. It completed all 53 rows with 0 skipped, 0 max-step rows, 0 process exits, 0 provider rate limits, 0 timeouts, 7.5% tool-failure row rate, and 0.0% formatting-failure rate. No max-step finalization was needed in that run.

Recent hardening:

- `eval/harness/spawn-agent.ts` pins both `H0X_CLI_STATE_DIR` and `ATOMIC_AGENT_STATE_DIR` to each per-case state directory.
- `eval-agents/harness/temp-workspace.ts` now defaults per-case workspaces under `G:\h0xi\atomic-agent\tmp\eval-agents`.
- `eval-agents/harness/append-report.ts` writes sanitized JSONL and classifies `max_steps_reached`, `process_exit`, `timeout`, `blank_reply`, and `missing_trace`.
- `eval-agents/harness/append-report.ts` also classifies provider `429`/rate-limit errors as `provider_rate_limit`.
- `eval/harness/spawn-agent.ts` sets `PYTHONIOENCODING=utf-8`, uses a G-drive cache root, and prepends `G:\h0xi\atomic-agent\.local\bin` so eval children can find the local ffmpeg binary.
- `eval-agents/harness/extract-answer.ts` keeps the prompt one-line and tells the agent to stop tool use once sufficient evidence exists.
- `src/tools/os/shell.ts` blocks package installs during eval runs and recovers common provider-malformed shell arg shapes.
- `src/tools/os/read-document/extractors/xlsx-extractor.ts` renders styled empty cells plus grid bounds, START/END landmarks, and coordinate-based fill summaries for spreadsheets.
- `eval-agents/harness/run-gaia-case.ts` pre-extracts `.xlsx` summaries into prompt hints and classifies tool-call/code-block final replies as `invalid_final_format`.
- `eval-agents/harness/xlsx-grid-analysis.ts` adds eval-only precomputed path candidates for movement-style workbook questions.
- `src/cli/run-agent.ts` now uses async line iteration for non-TTY piped input, drains stdout/stderr writes, and supports eval-only durable session-save suppression.
- `eval-agents/adapters/h0x-cli-adapter.ts` disables analytics in per-case GAIA config so benchmark child processes do not open PostHog handles or send product telemetry.
- `eval-agents/adapters/h0x-cli-adapter.ts` also has an eval-only Azure max-step finalizer that runs one tools-disabled completion from the latest trace tail and records recovery flags. It is a safety net and was not used by the final clean full run.

Current blocker:

- No current GAIA Level 1 infrastructure blocker is open. Remaining work is score improvement, full Level 2/3 validation if desired, and official test-split submission preparation.

## Next Commands

To rerun the same 5-task pilot:

```powershell
$env:OPENROUTER_API_KEY="<test key>"
$env:HF_TOKEN="<test key>"
$env:H0X_CLI_EVAL_AGENTS="h0x-cli"
$env:H0X_CLI_GAIA_MODEL="openai/gpt-4o-mini"
$env:H0X_CLI_GAIA_LIMIT="5"
$env:H0X_CLI_EVAL_TMP_DIR="G:\h0xi\atomic-agent\tmp\eval-agents"
npm run eval:agents:datasets
npm run eval:agents:level1
npm run eval:agents:scorecard
```

Keep tokens out of files and rotate the pasted test tokens after use.

To rerun the current Azure targeted cleanup path:

```powershell
$env:AZURE_OPENAI_API_KEY="<runtime key>"
$env:H0X_CLI_EVAL_AGENTS="h0x-cli"
$env:H0X_CLI_GAIA_PROVIDER="azure"
$env:H0X_CLI_GAIA_MODEL="gpt56testsolv2"
$env:H0X_CLI_GAIA_SOURCE="hf"
$env:H0X_CLI_GAIA_SPLIT="validation"
$env:H0X_CLI_GAIA_LEVEL="1"
$env:H0X_CLI_GAIA_MAX_STEPS="16"
$env:H0X_CLI_GAIA_TIMEOUT_MS="180000"
$env:H0X_CLI_GAIA_TASK_IDS="9318445f-fe6a-4e1b-acbf-c68228c9906a"
npm run eval:agents:matrix
npm run eval:agents:scorecard
```

To prepare a future leaderboard run after validation improves:

```powershell
npm run eval:agents:datasets -- --split test
$env:H0X_CLI_GAIA_ALLOW_TEST_RUN="1"
$env:H0X_CLI_EVAL_AGENTS="h0x-cli"
$env:H0X_CLI_GAIA_MODEL="openai/gpt-4o-mini"
npm run eval:agents:test
npm run eval:agents:export-submission -- --matrix eval-agents/reports/run-<ISO>/matrix.jsonl --split test --out eval-agents/reports/run-<ISO>/submission.jsonl
npm run eval:agents:validate-submission -- --file eval-agents/reports/run-<ISO>/submission.jsonl --split test
```

Only upload `submission.jsonl` to the official Hugging Face GAIA leaderboard. Do not upload validation reports, traces, attachments, or gold-answer files.

## Suggested Skills

- Use codebase-memory MCP for code discovery when changing eval internals.
- Use `hugging-face:huggingface-datasets` only for read-only dataset availability checks.
- Use a test-running subagent for independent verification before reporting benchmark numbers.
