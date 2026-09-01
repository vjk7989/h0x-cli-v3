# eval-agents — h0x-cli GAIA benchmark

Benchmark **h0x-cli** on GAIA-style tasks, with optional legacy comparison
adapters for **atomic-agent**, **Hermes**, and **OpenClaw**. Scoring uses the
official GAIA `question_scorer` normalization (exact match).

## Prerequisites

- `npm run build` (eval spawns `dist/cli/index.js` for h0x-cli).
- For the h0x OpenRouter adapter: `OPENROUTER_API_KEY`.
- For local/legacy comparison adapters: managed llama daemons or
  `H0X_CLI_EVAL_LLAMA_URL` / `ATOMIC_AGENT_EVAL_LLAMA_URL`.
- For local memory fabric: embedding daemon on port `19092` (started by
  `h0x-cli models start` when an embedding model is configured).
- Competitors: `hermes` and `openclaw` on `PATH` (skipped automatically when
  missing).
- Full GAIA (not smoke): `HF_TOKEN` + `npm run eval:agents:datasets`.

```bash
cp eval-agents/.env.example eval-agents/.env
# edit tokens / URLs
```

## Running

Unit tests (scoring + parsing, no LLM):

```bash
npm run eval:agents:lint
npx vitest run --config eval-agents/vitest.config.ts eval-agents/harness
```

Smoke (committed fixtures, h0x-cli through OpenRouter):

```bash
H0X_CLI_EVAL_AGENTS=h0x-cli \
H0X_CLI_GAIA_MODEL=openai/gpt-4o-mini \
npm run eval:agents:smoke
```

GAIA validation Level 1 (real dataset):

```bash
npm run eval:agents:datasets   # once
H0X_CLI_EVAL_AGENTS=h0x-cli \
H0X_CLI_GAIA_LIMIT=5 \
H0X_CLI_GAIA_MODEL=openai/gpt-4o-mini \
npm run eval:agents:level1
```

GAIA validation all levels:

```bash
H0X_CLI_EVAL_AGENTS=h0x-cli \
H0X_CLI_GAIA_MODEL=openai/gpt-4o-mini \
npm run eval:agents:validation
```

Official GAIA test split is guarded so it is not run accidentally:

```bash
npm run eval:agents:datasets -- --split test
H0X_CLI_GAIA_ALLOW_TEST_RUN=1 \
H0X_CLI_EVAL_AGENTS=h0x-cli \
H0X_CLI_GAIA_MODEL=openai/gpt-4o-mini \
npm run eval:agents:test
```

Create and validate a Hugging Face leaderboard upload file from a complete
official test report:

```bash
npm run eval:agents:export-submission -- \
  --matrix eval-agents/reports/run-<ISO>/matrix.jsonl \
  --split test \
  --out eval-agents/reports/run-<ISO>/submission.jsonl

npm run eval:agents:validate-submission -- \
  --file eval-agents/reports/run-<ISO>/submission.jsonl \
  --split test
```

Filter agents:

```bash
H0X_CLI_EVAL_AGENTS=h0x-cli npm run eval:agents:smoke
```

Scorecard:

```bash
npm run eval:agents:scorecard
```

## Reports

Each run writes `eval-agents/reports/run-<ISO>/`:

- `matrix.csv` / `matrix.jsonl` — per (agent × question) row
- `environment.json` — pinned model, sampling, git SHA
- `submission.jsonl` — generated only by `eval:agents:export-submission`

The leaderboard upload file contains GAIA's required `task_id` and
`model_answer` string fields, plus optional `reasoning_trace` when a future
exporter explicitly includes it. Do not publish validation/test prompts,
attachments, traces, or gold answers.

## Methodology

- **h0x-cli OpenRouter**: fixed model from `H0X_CLI_GAIA_MODEL`
  (`openai/gpt-4o-mini` for the pilot).
- **Legacy local comparisons**: shared `llama-server` URL for all agents.
- **atomic-agent compatibility adapter**: memory fabric **on** (chat + embedding daemons when available).
- **Hermes / OpenClaw**: stock CLI, local OpenAI-compatible endpoint.
- **Prompt**: GAIA prefix + `FINAL ANSWER:` convention; scorer is deterministic.
- **Hermetic smoke**: `datasets/gaia/fixtures/smoke-level1.json` (no HF leak).

## Leaderboard Gate

Do not submit the current pilot. The latest real validation pilot is 1/5
(20.0%) on Level 1, so the next engineering target is reducing tool/read
failures before running the full validation set. When validation is strong,
run the complete official test split once, export `submission.jsonl`, validate
the expected 301 rows (93 Level 1, 159 Level 2, 49 Level 3), then upload that
file through the official Hugging Face GAIA leaderboard Space.

See [docs/PHASE0-COMPATIBILITY.md](docs/PHASE0-COMPATIBILITY.md) for research
notes and known risks.
