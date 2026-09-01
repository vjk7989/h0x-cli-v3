# Agent-Reach Audit

Date: 2026-09-02.

## Source

- Repository: https://github.com/Panniantong/agent-reach
- Audit clone: `G:\h0xi\agent-reach-audit`
- Checked revision: `da5044d26fc6adddb6554d5679c94ac22e76e428`
- License: MIT

This note is sanitized. It records capability, connector, endpoint, and GAIA
failure-category evidence only. It does not include raw GAIA prompts, gold
answers, full model replies, cookies, tokens, or `.env` values.

## What It Is

Agent-Reach is a Python installer, doctor, and configuration layer for external
platform tools. Its own core module says actual reading/searching should be done
by upstream tools directly after installation, not through a single wrapper API.

Relevant components:

- `agent_reach.channels.web.WebChannel` reads arbitrary public HTTP(S) pages
  through Jina Reader at `https://r.jina.ai/{url}`.
- `agent_reach.channels.exa_search.ExaSearchChannel` checks for `mcporter` and
  Exa MCP configuration at `https://mcp.exa.ai/mcp`.
- `agent_reach.channels.github.GitHubChannel` checks the `gh` CLI while setting
  GitHub telemetry/update-notifier opt-out environment values.
- `agent_reach.channels.youtube.YouTubeChannel` checks `yt-dlp`, Node/Deno JS
  runtime availability, and optional transcription readiness.
- Optional platform channels cover Reddit, Twitter/X, Bilibili, XiaoHongShu,
  LinkedIn, Facebook, Instagram, V2EX, RSS, Xueqiu, and Xiaoyuzhou.
- Optional extras include Playwright, MCP, and browser-cookie extraction.

## Endpoint And Credential Surface

Observed endpoint classes:

- Jina Reader: `https://r.jina.ai/`
- Exa MCP: `https://mcp.exa.ai/mcp`
- Local MCP demo endpoint: `http://localhost:18060/mcp`
- OpenCLI loopback status: `http://127.0.0.1:19825/status`
- GitHub: `github.com` / `api.github.com` through `gh`
- YouTube and other public platform domains through external CLIs or APIs
- Optional transcription providers: Groq and OpenAI endpoints in
  `agent_reach.transcribe`

Credential/storage behavior:

- Default private config path is `~/.agent-reach/config.yaml`.
- Config keys include API keys, GitHub token, cookies, proxy, and transcription
  provider keys.
- Config serialization masks sensitive values in `Config.to_dict()`.
- Private writes use symlink checks and owner-only permissions where the OS
  supports them.
- MCP server exposes only a `get_status` tool and constructs config read-only.
- External subprocesses and CLIs can still inherit ambient environment unless
  the caller isolates them.

## Test Evidence

Command run from the audit clone:

```powershell
python -m pytest -q
```

Result:

- `561 passed`
- `15 skipped`
- `10 failed`

Failure categories:

- Ambient local credentials made config tests think OpenAI-related features were
  configured.
- `yt_dlp` was not importable in the current Python environment.
- `ffprobe` was not available on `PATH` for a transcription test.
- Several Xiaoyuzhou shell-script tests failed under Windows/Git Bash path/URL
  handling.

These failures do not prove Agent-Reach is unsafe, but they do prove it is not a
clean drop-in dependency for this Windows GAIA harness without isolated HOME,
TMP, PATH, Python dependency, and subprocess handling.

## Comparison With h0x-cli Web Tools

The native h0x web stack already covers the generic GAIA needs better than a
direct Jina wrapper in several areas:

- `os.web.search` supports configured provider search, Exa API/MCP paths,
  DuckDuckGo fallback, cache, and provider cooldown.
- `os.web.fetch` uses curl with SSRF protection, redirect-hop revalidation,
  transient retry, browser-like headers, markdown/HTML extraction, and challenge
  detection.
- `os.http.request` already covers raw API/JSON cases with existing approval and
  config gates.

Agent-Reach may still be useful as a reference for source routing and fallback
provider ideas. It should not be enabled as a default product connector at this
stage.

## GAIA Miss Comparison

Source baseline: `eval-agents/reports/run-2026-09-01T10-22-08-966Z`, score
`46/53` on validation Level 1.

| Task ID | Observed Pattern | Likely Category | Agent-Reach Help |
|---|---|---|---|
| `e1fc63a2-da7a-432f-be78-7c4a95598703` | two `os.web.search`, then reply | search-snippet reasoning/calculation | Low to medium; extra search may help, but no platform connector gap is shown. |
| `46719c30-f4c3-4cad-be07-d5cb21eee6bb` | repeated search/fetch, readable pages | source reconciliation/entity disambiguation | Low; native fetch/API access already worked. |
| `e142056d-56ab-4352-b091-b56054bd1359` | two `os.shell.run`, then reply | deterministic reasoning/calculation | None; not a web connector problem. |
| `7673d772-ef80-4f0f-a602-1bf4485c9b43` | multiple searches, two readable fetches, loop warning | long reference/legal extraction | Low; native fetch reached readable pages. |
| `c365c1c7-a3db-4d5e-a9a1-66f56eae7865` | three `os.web.search`, then reply | search-only answer discipline | Medium as search breadth only; safer to improve native eval discipline first. |

## Recommendation

Do not vendor or integrate Agent-Reach into `h0x-cli` now.

Keep `G:\h0xi\agent-reach-audit` as a scratch audit clone for reference. Delete
it later if no follow-up experiment is approved. The smallest useful next work
is native h0x-cli improvement:

- Add sanitized trace/reporting for search-only final answers.
- Improve native web search result diversity and degradation visibility.
- Improve long-page `os.web.fetch` evidence by adding compact heading/section
  snippets for matched terms.
- Improve JSON/API compression for evidence-heavy public APIs.
- Add an eval-only calculation verification hint or tool path for deterministic
  numeric answers.

An Agent-Reach-backed adapter should be considered only after a separate plan
proves it is eval-only, disabled by default, cookie-free, MCP-write-free, and
measurably improves the five remaining web/reasoning misses.
