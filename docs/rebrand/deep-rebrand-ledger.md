# Deep Rebrand Ledger

Date: 2026-09-01

Scope: remaining `atomic-agent`, `Atomic Agent`, `ATOMIC_AGENT_*`, `.atomic-agent`,
`atomic-llama`, update/release, prompt, CLI/TUI, test, doc, workflow, script,
generated metadata, and eval-harness references after the compatibility-first
deep rebrand pass.

Raw scan evidence is in `docs/rebrand/remaining-branding-scan.raw.txt`. This
ledger classifies the important remaining references so later agents do not
guess whether a string is stale.

## Replace Now

These active identity surfaces were changed in this pass:

| Area | Current state |
| --- | --- |
| Stable system prompt | `src/prompt/stable-prefix.ts` now identifies the assistant as `h0x-cli`, built by `TEAM PAVii.Ai`, and adds the YAGNI rule. This intentionally invalidates prior stable-prefix cache bytes. |
| Prompt identity tests | `src/prompt/build-prompt.test.ts` asserts h0x/PAVii identity and guards against Atomic self-identity. |
| Telegram active copy | `src/channels/telegram/welcome-message.ts` and `src/channels/telegram/inbound-handler.ts` use `h0x-cli` active copy. |
| Debug bundles | `src/tui/debug-bundle/build-snapshot.ts`, `src/tui/chat-orchestrator.ts`, and menu copy use `h0x-cli-debug`. |
| HTTP model/health identity | `src/http/route-health.ts`, `src/http/route-models.ts`, and `src/http/openai-chat-completions.ts` expose h0x runtime/model identity while preserving compatible headers. |
| CLI/runtime hints | `src/sidecar/main.ts`, `src/local-llm/daemon-lifecycle.ts`, `src/llm/describe-llama-health-failure.ts`, and `src/cli/serve-command.ts` now point users at h0x commands and env names first. |
| Uninstall active surfaces | `src/uninstall/*`, `src/cli/uninstall-command.ts`, and TUI uninstall tests now remove/show h0x primary paths plus intentional legacy aliases. |
| Active docs | `README.md`, `PROMPT.md`, `BUNDLING.md`, and `.env.example` now prefer h0x command/env/path examples while retaining clearly labelled compatibility notes. |

## Compatibility

Keep these unless a later migration stage explicitly removes or protocol-tests
the change:

| Reference | Reason |
| --- | --- |
| `atomic-agent` command alias | Existing installs and scripts may invoke it; installers/uninstallers treat it as a legacy compatibility alias. |
| `atag` command alias | Existing short alias; keep installed and removable. |
| `atomic-agent-sidecar` command | Existing sidecar launcher identity; package alias remains for host compatibility. |
| `ATOMIC_AGENT_*` env vars | Legacy aliases accepted when matching `H0X_CLI_*` names are absent. |
| `.atomic-agent` state/project paths | Legacy state is copied forward and legacy project skills remain readable. Do not delete old data. |
| `X-Atomic-*` HTTP/SSE headers | OpenAI-compatible server extensions remain protocol compatibility fields for existing clients. |
| `__ATOMIC_AGENT_VERSION__` build define | Internal build-time constant; rename only with a release/build migration test. |
| Config schema fields and trace/event names | Stored data and host integrations may rely on these names. |

## Provider Or Third Party

Preserve these names/endpoints because they describe real external projects or
providers, not h0x ownership:

| Reference | Reason |
| --- | --- |
| `llama.cpp`, `ggml`, `llama-server`, `llama-*` binaries | Real backend project, library, API, and executable names. |
| GitHub, Hugging Face, Telegram, OpenRouter, AI/ML API, ClawHub, MCP | Real provider/service names and protocols. |
| `AtomicBot-ai/atomic-llama-cpp-turboquant-nightly` | Current managed backend source until PAVii fork artifacts are built and verified. |
| Upstream `ggml-org/llama.cpp` links in backend fork | Upstream project docs, badges, issue templates, examples, and API references. |
| `TheTom` funding entry in backend fork | Upstream/third-party attribution; do not rewrite as PAVii ownership. |

## Historical Attribution

Keep these in README/docs/license/eval provenance:

| Reference | Reason |
| --- | --- |
| Atomic Agent fork notice and MIT/license history | Legal and historical provenance. |
| README benchmark section naming Atomic Agent | Historical upstream benchmark results, not h0x-certified performance claims. |
| `eval-agents` provenance and release links | Reproducibility for original benchmark artifacts. |
| Upstream release links inside archived docs | Historical evidence unless converted into active install/update instructions. |

## Deferred Risky

Do not change these during this phase:

| Reference | Risk |
| --- | --- |
| Managed backend download repo in `src/local-llm/backend-installer.ts` | Pointing to `vjk7989/h0x-llama-cpp-turboquant-nightly` before artifacts exist would break model setup. |
| Sidecar protocol fields and NDJSON event names | Host integration compatibility risk. |
| HTTP extension header names | Client compatibility risk. |
| DB/storage schema keys | Data migration risk. |
| Eval harness labels and baseline names | Could corrupt benchmark provenance and comparisons. |
| Stable-prefix salt beyond the documented h0x change | Additional cache invalidation without benefit. |
| Backend C/C++ kernels, quantization, APIs, build flags, model formats, and runtime defaults | Performance and behavior risk; untouched in the backend fork prep. |

## Backend Fork State

The backend clone lives outside this monorepo at
`G:\h0xi\h0x-llama-cpp-turboquant-nightly`.

- `upstream`: `https://github.com/AtomicBot-ai/atomic-llama-cpp-turboquant-nightly.git`
- `origin`: `https://github.com/vjk7989/h0x-llama-cpp-turboquant-nightly.git`
- Branch: `feature/turboquant-kv-cache`

Changed backend surfaces are limited to:

- `README.md`: added a PAVii fork wrapper while preserving upstream `llama.cpp`
  README below it.
- `.github/workflows/tqp-release.yml`: renamed workflow and release artifact
  prefixes to `h0x-turboquant`.
- `.github/workflows/tqp-linux-release.yml`: renamed workflow and release
  artifact prefixes to `h0x-turboquant`.

No backend code, API, ABI, model format handling, build flags, or runtime
defaults were changed.
