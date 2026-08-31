# Outbound endpoint ledger

Audit date: 2026-08-31. Product: h0x-cli 0.4.2. This is an inventory, not an allowlist.
Dynamic endpoints are families, not a promise to enumerate future user-selected hosts.
See [findings](findings.md), [verification](verification.md), and
[dependency/build evidence](dependencies-and-build.md).

## Evidence states

- Present: executable code/dependency exists; a URL in documentation alone does not qualify.
- Configured: endpoint/settings exist. Enabled: runtime gate permits operation.
- Attempted: transport invoked. Connected: transport handshake established.
- Sent: application payload handed to transport/received by fixture. Acknowledged: fixture/service response observed.
- `static`: source supports a path, not proof it executed on this machine.
- `mock`: transport was intercepted; no DNS/socket/remote receipt occurred.
- `loopback`: synthetic request received by a local test server, never by the named provider.
- `unknown`: not observed. Neither configured credentials nor HTTP success proves remote retention.

Unless stated otherwise, real-service attempted/connected/sent/acknowledged states
are **unknown**. No authenticated remote probe was authorized. Local tests are
listed separately in verification, not promoted into real-service connection status.

## Runtime destinations

| ID / destination and owner | Purpose and trigger | Data / credential source | Current configuration and evidence | Disposition / source |
| --- | --- | --- | --- | --- |
| R01 `us.i.posthog.com`, PostHog | Install/open/onboarding/model/turn events; flush on shutdown | Stable install UUID, OS/version, model/provider, usage counts/timing; embedded project key | Present; saved analytics flag true, but factory disabled by `PLACEHOLDER` in source and dist. No active client from production bootstrap | Keep disabled pending policy. `src/analytics/analytics-client.ts:115`, `analytics-events.ts:6`, `src/runtime/bootstrap.ts:640` |
| R02 Sentry envelope endpoint derived from DSN | Uncaught errors and LLM failure reporting | Scrubbed error fields, basename stack frames, transport hostname, install ID/version; embedded DSN | Present; DSN `PLACEHOLDER` disables runtime factory. Direct injected clients are test/library paths, not default bootstrap | Keep disabled; separately audit retained fields before enabling. `src/error-reporting/sentry-client.ts:116`, `sentry-envelope.ts`, `error-scrubber.ts:282` |
| R03 `openrouter.ai/api/v1/models`, OpenRouter | TUI mount and provider/LLM panel refresh; process cache | GET request/IP metadata, no chat body or key in this public fetcher | Enabled independently of configured providers. Static mount chain confirmed; catalog tests use mocks | Make automatic network policy explicit. `src/tui/tui-app.tsx:651`, `src/tui/tui-command.ts:444`, `src/tui/providers/providers-orchestrator.ts:86`, `src/llm/provider/openrouter/fetch-openrouter-chat-catalog.ts:7` |
| R04 `api.aimlapi.com/v1/models`, AI/ML API | Same catalog prefetch flow | Public GET metadata, no chat body or key in this fetcher | Same automatic path as R03, even with empty cloud provider list | Same as R03. `src/llm/provider/aimlapi/fetch-aimlapi-chat-catalog.ts:7` |
| R05 configured local-llama endpoint; default `127.0.0.1:8080` | Health/props, completion, tokenize/slot/model operations; startup, turns, auxiliary memory work | Prompt/context/tool outputs; optional `ATOMIC_AGENT_LLAMA_API_KEY` | Selected legacy local-llama fallback in launcher configuration. Origin is loopback; server behavior beyond that hop not audited | Preserve local function. Do not assume a custom LAN/remote URL is local. `src/llm/llama-server-client.ts:180`, `src/llm/provider/registry/provider-types.ts`, `src/config/load-config.ts:134` |
| R06 `openrouter.ai/api/v1/*` or configured base, OpenRouter | Chat, model verification/listing, optional embeddings/vision | Prompt/context or embedding text/image bytes, provider key; old `HTTP-Referer`, `X-Title`, categories | Provider not configured in saved state; inherited audit process has key presence only. Transport/identity tested synthetically | Rebrand attribution; retain provider identity. `src/llm/provider/registry/register-built-in-providers.ts:94`, `src/memory/embeddings/register-built-in-embedding-providers.ts:43`, `src/tui/providers/providers-wizard-target.ts:236` |
| R07 `api.aimlapi.com/v1/*` or configured base, AI/ML API | Selected model calls/verification | Prompt/context, key, `X-AIMLAPI-Source: agent/atomic-agent`; no default partner-ID header | Provider not configured. Public catalog R04 is independent | Rebrand source header subject to provider contract. `src/llm/provider/aimlapi/aimlapi-provider.ts:25` |
| R08 `generativelanguage.googleapis.com/v1beta/openai/*`, Google | Gemini chat/model list/verification/vision when selected | Prompt/context/images and provider key | Provider not configured | Keep provider name; operator/user owns credentials. `src/llm/provider/gemini/gemini-provider.ts:6`, `fetch-gemini-models.ts:60` |
| R09 arbitrary configured OpenAI-compatible/Qwen-compatible endpoints | Selected model calls, models and paid synthetic key verification | Prompts/context/images; Bearer or provider-specific key header; custom headers | No entries configured. Provider setup verification can spend tokens; it is not merely a local key check | Audit custom URL/header policy; do not probe real keys. `src/llm/provider/openai/openai-http.ts:234`, `src/llm/provider/verify/verify-provider-key.ts:37` |
| R10 configured local or remote embedding endpoint | Memory indexing/recall/retrieval | Input text and optional key; OpenRouter attribution when selected | No active embedding provider; legacy embeddings disabled | Treat remote memory embedding as user-content transfer. `src/memory/embeddings/openai-embedding-provider.ts:34`, `embedding-client.ts:124` |
| R11 active vision provider, same destination family as model | `vision.describe` and configured image workflow | Full selected image bytes as base64 plus prompt | Vision enabled; actual supported provider required; no image sent in audit | Disclose image transfer. Local image path excluded from wire image object but remains in tool result. `src/tools/vision/describe.ts:117`, `src/llm/provider/openai/openai-describe-image.ts:18` |
| R12 `mcp.exa.ai/mcp`, Exa | Default web search without Exa API key | JSON-RPC search query/result count | Search enabled, Exa selected, no Exa key present in audit process | Functional query transfer, not telemetry. `src/tools/os/web-search/providers/exa-provider.ts:75` |
| R13 `api.exa.ai/search` or configured endpoint, Exa | Search with configured key | Query/options, `x-api-key` from configured env key (default `EXA_API_KEY`) | Available but keyed branch not selected by current observed environment | Review redirect credential forwarding. `src/tools/os/web-search/providers/exa-provider.ts:46` |
| R14 `html.duckduckgo.com/html/`, DuckDuckGo | Configured search fallback | Query in URL, browser-like User-Agent and language | Fallback enabled; not invoked by audit | Document query disclosure and fallback recipients. `src/tools/os/web-search/providers/duckduckgo-provider.ts:12` |
| R15 `api.search.brave.com/res/v1/web/search`, Brave | Optional search provider | Query URL; `X-Subscription-Token`, default `BRAVE_SEARCH_API_KEY` | Not selected; no observed key | Provider-controlled branding; audit redirect policy. `src/tools/os/web-search/providers/brave-provider.ts:9` |
| R16 configured SearXNG instance `/search` | Optional self-hosted/third-party search | Query URL; instance may forward to upstream engines | Not selected/configured | Record operator and downstream engines if enabled. `src/tools/os/web-search/providers/searxng-provider.ts:32` |
| R17 arbitrary public HTTP(S) destinations and DNS resolver | `os.http.request`, `os.web.fetch`; redirects and retries | URL, supplied headers/body for raw HTTP; request metadata for fetch; DNS hostnames | HTTP enabled, approval mode `never`, hostname allowlist `null`; SSRF checks remain. Mock tests prove unsafe raw HTTP/search redirect behavior | Security fixes before broad use. `src/tools/os/http-request.ts:70`, `http-request-fetch.ts:290`, `web-search/transport/search-http.ts:134`, `web-fetch-ssrf-guard.ts:10` |
| R18 configured MCP HTTP/SSE server | Startup/live enable/reconnect, catalog and tool/resource/prompt calls; sampling replies | Client identity/version, RPC arguments/resource URIs, configured headers; server-supplied sampling routed to active LLM | No configured MCP servers. Source handshake still `atomic-agent` / `0.1.0`; synthetic tests only | Rebrand our handshake; keep server/tool IDs. `src/mcp/mcp-client.ts:68`, `:143`, `:447`; sampling `src/mcp/mcp-sampling-handler.ts:62` |
| R19 MCP stdio subprocess; endpoints depend on installed program | Startup/live enable and RPC tool calls | Entire inherited process environment plus per-server env; cwd, RPC payloads | No configured server. Environment forwarding is source-confirmed; access is not transmission | Require trust/credential isolation design. Do not execute uncontained connector. `src/mcp/mcp-client.ts:417` |
| R20 Claude/Codex subscription CLI subprocess | Selected subscription-provider model turn | Prompt on stdin, cwd, inherited env; child owns authentication and network | No subscription provider configured. External authenticated programs not launched | Audit child separately; cannot rebrand third-party account/app by changing wrapper. `src/llm/provider/subscription-cli/stream-cli-completion.ts:28`, `subscription-cli-provider.ts:271` |
| R21 `api.telegram.org/bot<TOKEN>/*`, Telegram | Enabled channel startup/getMe/long polling, replies, progress and approvals | Token in API path, chat/user IDs, messages and approval previews | Telegram disabled; inherited audit process token present, not validated or used | User-owned bot required; exclude token URLs from logs. `src/channels/telegram/telegram-channel.ts:198`, `telegram-bot-factory.ts`, `approval-bridge.ts:149` |
| R22 Chromium CDP HTTP/WebSocket endpoint plus arbitrary webpages | Browser tool lazy startup/attach, searches, navigation and actions | CDP commands; queries, page inputs, browser profile cookies to webpages and subresources | Browser enabled, no external CDP override. Spawn flags suppress some background networking, not webpage tracking | Browser process tree/third-party pages require isolated runtime audit. `src/tools/browser/playwright-backend.ts`, `build-chrome-launch-args.ts:39` |
| R23 `api.github.com/repos/AtomicBot-ai/atomic-llama-cpp-turboquant-nightly/releases` plus returned asset/CDN hosts | Local-model panel refresh/backend check; managed backend install/auto-update | Release GETs, selected asset, User-Agent; `GITHUB_TOKEN`/`GH_TOKEN` when present | Backend auto-update flag true; check occurs on refresh even independently of auto-install gate. No GitHub token observed | Upstream supply-chain dependency remains. Own artifact pipeline needed before replacing. `src/local-llm/backend-installer.ts:15`, `:97`, `:285`; `src/tui/local-models/local-models-orchestrator.ts:261` |
| R24 `huggingface.co/api/*`, `/.../resolve/...`, redirected asset/CDN hosts | Model discovery/download, including custom model URLs | Repo/revision/file metadata, optional `HF_TOKEN`/`HUGGING_FACE_HUB_TOKEN` | No download invoked; tokens absent in observed audit environment | Fix download credential-host validation; preserve model licenses. `src/local-llm/huggingface-api.ts:9`, `download-file.ts:42`, `model-installer.ts:52` |
| R25 `clawhub.ai/api/v1/*` or configured registry | Skills browse/search/detail/download | Search/name/version, optional `CLAWHUB_TOKEN`, old User-Agent | Registry capability present; actual traffic unobserved | Rebrand client UA only; registry remains third party. `src/skills/clawhub/clawhub-client.ts:93`, `:241` |
| R26 `api.github.com`, `raw.githubusercontent.com` or supplied client bases | Skill taps, metadata/content retrieval | Repo/path/ref, optional `GITHUB_TOKEN`, old User-Agent | Capability present; no token observed, no fetch invoked | Retain actual repository owners and license history. `src/skills/hub/github-skill-client.ts:80`, `:235` |
| R27 arbitrary shell/skill commands | Approved shell and skill execution, scheduler tasks | Child inherits environment unless caller overrides; arbitrary permitted inputs/network | Capability present, behavior depends on command/skill | Not containable by a telemetry switch. Inspect installed code and process tree. `src/sandbox/command-runner.ts:74`, `src/skills/skill-script-runner.ts` |
| R28 custom log/metric/trace sinks, supplied by embedding host | Runtime events, tracing and shutdown | Logs, counts; traces can include prompt/tool args/results | Default log/metric arrays empty; trace sink writes local NDJSON. External sink behavior not available to audit | Document host boundary; no default remote exporter found. `src/runtime/bootstrap.ts:619`, `:2978`, `src/tracing/trace/trace-recorder.ts:197` |
| R29 HTTP server/webhooks and sidecar host | User launches serve/sidecar; incoming requests schedule turns | Responses/events to connected caller; webhook inputs may become model prompts | No configured inbound webhook binding; no serving process launched | Inbound interfaces, not hidden reporting. Host/caller may forward externally. `src/http/route-webhooks.ts:14`, `src/http/http-server.ts`, `src/sidecar/` |

### OpenAI-compatible preset destinations

`src/tui/providers/provider-presets.ts` contains Anthropic, Cerebras, DeepSeek,
Fireworks, Groq, Hyperbolic, Mistral, Moonshot, Nous, Novita, Ollama Cloud,
Perplexity, Qwen/DashScope, SambaNova, Sarvam, Together, and xAI endpoints;
LM Studio and local Ollama use loopback. The generic default is `api.openai.com`.
Preset presence is not configuration or an automatic request to every provider.
Custom providers and proxies can add other owners; API compatibility must be
verified independently, not assumed from the preset label.

Configured fallback chains can send the same prompt/context to additional providers
after a failure (`src/runtime/llm-fallback-seam.ts:54`). Recipients are therefore not
necessarily limited to the currently displayed primary model. Auxiliary memory and
sampling calls also follow their configured model clients, independently of telemetry.

## Build, install, test and documentation boundaries

| ID | Boundary | Evidence and disposition |
| --- | --- | --- |
| B01 | Sentry build plugin | Token-gated source-map/release upload uses upstream organization/project. Separate from disabled runtime DSN. See dependency/build report for exact workflow and source contents. |
| B02 | npm/dependency lifecycle/native binary downloads | Registry metadata/tarballs and prebuilt binary fetches during installation; package hooks may execute arbitrary code. Not run during audit; inspect locked versions/hooks, not just package.json. |
| B03 | Release assets/signing/GitHub workflows | Upstream installer URLs, GitHub actions, code-signing/token services and artifact publication. Not ordinary TUI traffic; no workflow or signing operation triggered. |
| B04 | Evaluation and judge runners | Benchmark downloads and model/judge requests may transmit evaluation prompts/transcripts. Not normal startup; no eval launched. |
| B05 | Installed/starter skills | Instructions/commands may access named APIs using separate tools/credentials. Static inventory only; no skill scripts executed. |
| B06 | Visible website/docs/license links | `pavii.tech`, temporary `/docs`, upstream attribution/comments and provider docs are not automatic requests merely because rendered. Opening them can contact their owner. |
| B07 | Disabled app self-update | `checkForAppUpdate`, `runAppUpdate` fail closed; old pure invocation builder still contains installer URLs but does not execute. `src/update/run-app-update.ts:135`. Managed backend R23 remains separate. |

No UTM/affiliate URL parameters were found by the explicit first-party source
and starter-skill pattern search. The AI/ML partner-ID reference is a removal
comment, not an emitted header. OpenRouter app attribution remains usage
attribution; absence of an affiliate URL is not absence of all tracking.
Dependency/website/dynamically generated links are not covered by that negative claim.
