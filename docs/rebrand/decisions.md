# ADR: h0x-cli Surface Rebrand

Date: 2026-08-31. Decision: approved. Delivery status: local rebrand and approved visual follow-up COMPLETE. Tests, typecheck, build/install, source matrix, built-CLI PTY, and final command smoke passed; all work processes stopped. Only the user's manual check and prior full-suite push blockers remain open. No full-suite rerun or push was performed. Source changes remain uncommitted; no commit or remote change has occurred. Completed checks below come from the parent and linked reports, not from tests run by this documentation agent.

Approved visual follow-up: Stage 1 artwork gate GREEN; Stage 2 fully GREEN with 320 tests across 23 files and typecheck exit 0 after the contrast fix. Build and install exited 0; all four wrappers verified. Source PTY 10/10, built-CLI PTY 1/1, visual inspection, and final command smoke 8/8 passed, with caller cwd preserved in all eight smoke cases. No production changes followed the 320-test gate.

## Context and Identity

The product is a fork of Atomic Agent. The goal is surface rebranding first, distribution/core rebranding later, then launch and original features. [PRODUCT.md](../../PRODUCT.md) is the identity register: **h0x - CLI**, command/package/banner **h0x-cli**, **Built by TEAM PAVii.Ai**, website **pavii.tech**, and temporary **https://pavii.tech/docs**. Label that docs address as a placeholder; do not imply it is live.

## Approved Decisions

- Preserve the full-screen React/Ink application. A no-argument `h0x-cli` launch stays in the invoking terminal and inherits its working directory; do not introduce a new terminal window or UI framework.
- Keep `atomic-agent`, `atag`, and `atomic-agent-sidecar` as compatibility commands. Retain the current version, config keys, environment-variable names, and storage discovery. No sidecar NDJSON or HTTP API changes.
- Create original static dotted artwork spelling `h0x-cli`; use the supplied Kiro image for visual inspiration only. Use `#B084F5` on dark backgrounds and `#6B35B5` on light backgrounds. Preserve warning/error semantics and no-color usability; screenshot and interactive verification are tracked separately below.
- Show the welcome only for empty idle chats. Keep the composer visible; fall back to plain branding on small terminals and fit long metadata without overflow. Preserve first-run setup, navigation, permissions, and model controls.
- Read active model and directory from existing session/UI state. Discover Git context asynchronously through argument-array subprocess calls, with a two-second timeout. Refresh on directory changes, welcome entry, and turn completion; discard stale results after directory changes. Never invent model or repository data.
- Disable upstream PostHog/Sentry ingestion through existing disabled sentinels. Disable upstream update checks and installation until fork release packaging exists; show truthful unavailable-state copy.
- Preserve upstream history, attribution, third-party names, and [LICENSE](../../LICENSE), including `Copyright (c) 2026 Atomic Bot`. Do not replace copyright as part of branding.
- Destination: https://github.com/vjk7989/h0x-cli-v3. Preserve the old remote as `upstream`, use the destination as `origin`, and push a tested `codex/rebrand-surface` branch without force-pushing. No package or release publication in this stage.

## Approved Visual Follow-up

Status: completed and verified locally. This is limited to artwork legibility and theme behavior, not approval for the broader fixes in [failure-plan.md](failure-plan.md).

- Refine the original dotted lowercase `h0x-cli` artwork with denser, clearer strokes. Keep the zero distinguishable from a letter and lowercase `l` distinguishable from `i`; make the title and compact fallback bold. Preserve fitting and composer visibility on small terminals.
- Classic theme defaults remain purple: dark `#b084f5`, light `#6b35b5`, with purple interface chrome. `brandMark` follows each theme's accent rather than forcing the classic color across all themes.
- Reuse existing theme selection/config behavior: brand color updates during live preview, cancel restores the prior selection, and applying a selection persists it. Preserve APIs, configuration compatibility, and semantic status colors; do not recolor warnings/errors as brand chrome.
- Acceptance status: tests/typecheck, refreshed build/install, source and built-CLI PTY checks, visual inspection, and final command smoke passed. The user's manual check remains open; the earlier full-suite failure remains a separate push blocker.

Stage 1 update from parent: artwork now uses dense U+28FF braille, two-space glyph separation, an existing slashed zero, and a curved lowercase `l` foot distinct from `i`. Both artwork and the plain title/onboarding identity are bold. Current dimensions are in the map below. The follow-up baseline passed 174 tests across 13 files plus type checking; this baseline is not a post-change gate or a clean-baseline rerun of the older full-suite failures.

Stage 1 post-change gate: GREEN, 139 tests across 10 files plus type checking, per parent. The prior TS2532 row-index failure was fixed with a non-null assertion justified by bounded indexing; retain that initial failure as history, not a current blocker.

Stage 2 production changes and contrast fix are saved per parent; 320 tests across 23 files passed on retry and typecheck exited 0. Classic palette assignments:

| Tokens | Dark | Light |
| --- | --- | --- |
| user / accent / info / brandMark | `#b084f5` | `#6b35b5` |
| accentSoft | `#4b2870` | `#cbb7e5` |
| rail background | `#382052` | `#ede7f3` |
| railMuted | `#cbb8e5` | Unchanged |
| railAccent | `#d8baff` | `#6b35b5` |
| badge | `#1d1828` | `#e6dcf2` |
| chipForeground | `#000000` | Unchanged |

The other four themes use their own accent for `brandMark`. Sidebar title uses `railAccent`; the selected theme label and footer hints use readable accent text rather than a fill token. Semantic status tokens remain untouched. Tests/typecheck and refreshed installation passed.

Stage 2 contrast failure history: the context chip at a mid-ramp color measured 4.15:1, below the 4.5:1 requirement. Classic dark `chipForeground` is now neutral black (`#000000`), yielding a reported minimum 4.8127:1 across the ramp. The 320-test retry passed after this fix; the initial contrast failure is resolved.

Terminal verification: source matrix 10/10 and final built CLI at 120x40 1/1 passed, including editable input, natural exit 0, and observed terminal-mode restoration. Parent inspected all 11 screenshots. Refer to [the consolidated visual summary](../../.local/reports/readability-visual-summary.md) for the theme/size matrix, artifacts, resolved harness-only CSI 9001/quit issues, and evidence limits. Images replay real ConPTY ANSI through xterm, not native screen capture; native mouse-mode restoration was not independently established. Startup captures do not replace focused preview/apply/cancel tests or the user's manual check.

Final refreshed delivery: build exit 0, install exit 0, all four wrappers present, and command smoke 8/8 with unchanged caller cwd. See [installation and smoke summary](../../.local/reports/readability-install-smoke-summary.md) for commands, environment, logs, and scope limits. Parent's `git diff --check` exited 0 with LF/CRLF warnings only. No production changes occurred after the 320-test gate; all build, install, smoke, and capture processes completed and stopped. No full-suite rerun or push was performed.

The existing artwork/render/fit entry points in the map below remain the navigation starting points; record changed theme integration paths only after implementation evidence arrives. The earlier full-suite failure and push gate remain BLOCKED regardless of this follow-up's focused results. All generated work stays within the G-drive repo.

## Codebase Map

Paths below are repository-relative entry points from the knowledge graph, manifest, and parent implementation updates. They are navigation guidance; the evidence section distinguishes implemented work from verified behavior. Re-query the graph as concurrent work evolves.

| Area | Entry points and purpose |
| --- | --- |
| Package/launch | `package.json` maps executable aliases to `dist/cli/index.js`; `src/cli/` owns command dispatch and help. |
| Local install | `scripts/install-local.ps1` generates four launchers in `.local/bin`: `h0x-cli`, `atomic-agent`, `atag`, and `atomic-agent-sidecar`. Launchers pin runtime/state to G-drive paths and do not change cwd. Installation SUCCESS: build exit 0, npm link exit 0, four aliases installed. Local CLI smoke passed 8/8; live sidecar smoke was not run. |
| TUI state | `src/tui/tui-app.tsx` owns UI state/callbacks; `src/tui/chat-orchestrator.ts` connects runtime operations and currently includes update checking. |
| Welcome lifecycle | `src/tui/components/chat-log.tsx` controls chat rendering; `src/tui/components/splash-banner.tsx` composes the welcome. |
| Artwork/fit | `src/tui/components/h0x-art.ts` now supplies full 82x7 and small 47x7 artwork for the visual follow-up, with a bold plain compact title fallback; `logo.tsx` and `splash-fit.ts` handle rendering and fit in the same directory. These replace the first-stage dimensions. |
| Workspace context | `src/tui/read-git-context.ts` defines Git context discovery; `src/tui/hooks/use-git-context.ts` feeds `ChatLog`. Existing `selectPromptLlmMeta` is reused for model metadata. |
| Persistent branding | `src/tui/components/sidebar.tsx` contains `RailBrand`; other visible controls live under `src/tui/components/`. |
| Runtime wiring | `src/runtime/bootstrap.ts` creates runtime dependencies, config, providers, memory, approvals, and reporting. Avoid unrelated refactoring. |
| Health-hint copy | `src/llm/llama-server-health.ts`: `formatLlamaUnreachableHint` contains two command examples; `src/runtime/bootstrap.ts`: `managedLocalLlmHealthFailureHint` contains three. Parent rebranded these named hints only; no broader core or health-check behavior change. |
| Reporting | `src/analytics/analytics-client.ts` and `src/error-reporting/sentry-client.ts` construct reporting clients. |
| Fork update guard | `src/update/check-app-update.ts` defines shared `APP_UPDATE_UNAVAILABLE`, exported through `src/update/index.ts`. Offline failure guards passed the Stage 4 protection gate. |
| Compatibility boundary | `src/config/` owns config; `src/sidecar/` and `src/http/` expose host interfaces; `src/update/` owns updater behavior. |
| Agent core | `src/agent/` runs turns/tools; `src/prompt/build-prompt.ts` constructs the prompt. Surface rebranding must preserve runtime invariants in `AGENTS.md`. |

First-stage delivery and CLI smoke passed, with results below. The approved follow-up is also complete locally, including tests/typecheck, refreshed build/install, source matrix, built-CLI PTY, and final command smoke. The earlier full suite failed and was not rerun. No commit, remote change, or push has occurred; all source changes remain uncommitted.

## Stages and Evidence

Parent owns implementation, tests, and evidence updates. Stage 2 passed lint and 38 tests across six command/terminal test files: see [Stage 2 summary](../../.local/reports/rebrand-stage2-summary.md) for commands, counts, environment, and logs. This gate does not cover UI/artwork suites or the full suite. Reports are local ignored artifacts and may be unavailable in a fresh clone.

The parent also reports fixes for baseline generated-old-art check defects: use `fileURLToPath` for filesystem paths, `process.execPath` for the running Node executable, and CRLF normalization in the generator. The Stage 2 report predates clearance of that generated-art failure; a passing rerun is not recorded here.

Stage 3 is GREEN: type checking passed, followed by 202 tests across 13 files, including all 10 Git-context and seven hook tests. See the PASS rerun section of [the comprehensive UI gate summary](../../.local/reports/rebrand-ui-comprehensive-gate-summary.md). The report retains the initial failure for history: Halley applied the analyst-approved fix to scope the overbroad `.gguf` assertion to the composer row, and the rerun passed without bail skips. The earlier 110-test artwork/theme subset is superseded by this comprehensive result, not added to its count.

Stage 4 is GREEN: type checking and 179 tests across 17 suites passed; see [the protection gate summary](../../.local/reports/rebrand-stage4-protection-summary.md). Upstream telemetry credentials use `PLACEHOLDER` sentinels; `checkForAppUpdate` throws an offline-unavailable error; `canSelfUpdate` returns false; `runAppUpdate` throws and no longer contains spawn execution. `APP_UPDATE_UNAVAILABLE` is shared through `src/update/check-app-update.ts` and its barrel export. CLI update help describes the unavailable state. The pure `buildUpdateInvocation` builder remains inert for deferred packaging and must not be interpreted as an enabled update path.

Parent reports final copy and README updates complete, retaining upstream benchmark attribution. The parent also updated the `AGENTS.md` title and mission for h0x CLI and compatibility aliases; this documentation agent did not edit that file. After the final focused gate passed, `scripts/install-local.ps1` completed successfully: build exit 0, npm link exit 0, and all four aliases installed.

Installed local command smoke: GREEN, 8/8 actual `.local/bin/*.cmd` invocations. `h0x-cli`, `atomic-agent`, and `atag` returned identical help and version output (`h0x-cli 0.4.2`); `update --check` returned the expected unavailable message with exit 1; blank piped stdin returned the expected interactive-TTY refusal with exit 1. Caller cwd remained unchanged in all eight cases. See [smoke summary](../../.local/reports/rebrand-local-command-smoke-summary.md) and [captured JSON](../../.local/reports/rebrand-local-command-smoke.json). The smoke used absolute wrapper paths, so it does not establish fresh-shell PATH discovery. Sidecar alias mapping is covered by earlier tests, but live sidecar NDJSON smoke was not run. These checks do not establish interactive keyboard/restoration behavior.

Final focused gate: initial run FAILED with 327 tests passed and one failed. The failure exposed missed old-brand command copy in a shared health hint, not a behavior regression. Following Rawls' fix plan, the parent updated only the two command examples in `formatLlamaUnreachableHint` and three in `managedLocalLlmHealthFailureHint`, identified in the map above. Updated tests and the subsequent environment fix cleared the focused gate: 973/973 tests across 85 files, including bootstrap, passed; type checking exited 0. See [focused rerun log](../../.local/reports/rebrand-stage5-focused-git-path.log), [bootstrap rerun log](../../.local/reports/rebrand-stage5-bootstrap-git-path.log) (26/26), and [typecheck log](../../.local/reports/rebrand-stage5-typecheck.log). Do not add the bootstrap count to the inclusive focused total.

Full suite: FAIL, run without exclusions using two workers. Exact result: 6,527 tests total, 6,509 passed, 14 failed, four skipped; 618 files total, 608 passed, 10 failed; duration 300.81 seconds, exit 1. Evidence: [full-suite log](../../.local/reports/rebrand-stage5-full.log) and [JSON report](../../.local/reports/rebrand-stage5-full.json). Rawls' completed diagnosis maps all 14 failures across 10 files: 12 likely fixture/environment issues, one CI-known sidecar extra-`m3` failure with unresolved cause, and one pre-existing Windows uninstall safety predicate defect. No rebrand-specific regression was identified, but no clean-baseline rerun is claimed; unchanged files alone do not establish baseline reproduction. The full-test/push gate remains BLOCKED: no commit, remote change, or push has occurred.

Broader failure fixes await the user's response to the parent's permission request; no response is recorded yet. The completed [failure-plan.md](failure-plan.md) contains the inventory, evidence limits, proposed repairs, and verification sequence. The separately approved visual follow-up does not authorize those broader fixes or waive the failing full-suite gate. The user's broader-scope decision and manual interaction check remain pending.

Windows verification environment: a bootstrap grant test failed with `spawn ls ENOENT` because PowerShell's `ls` alias is not an executable available to Node subprocesses. Rawls confirmed the installed `C:\Program Files\Git\usr\bin\ls.exe` works read-only. For reproducible reruns, put `G:\h0xi\atomic-agent\.local\runtime\node-v25.7.0-win-x64` FIRST on the test process PATH, retain the inherited PATH, and APPEND `C:\Program Files\Git\usr\bin`. Keep temporary files, caches, and outputs under the G-drive repo as before. This is process-scoped test setup only: no C-drive writes, no user/global PATH mutation, and no fixture or production edits for this environment issue. Do not confuse it with the separate local installer's user-PATH setup. Bootstrap and final focused reruns passed with this environment.

First-stage screenshot inspection passed at 40x20, 80x24, and 120x40. The follow-up now has its own passing 10-case final-source interaction/restoration matrix and visual inspection described above; it no longer relies on older screenshots or the previously blocked harness. A separate user manual check has not been reported.

| Stage | Acceptance gate |
| --- | --- |
| Environment/baseline | Pinned G-drive Node first on test PATH; append installed Git `usr\bin` process-only for `ls.exe`. All generated artifacts stay under the G-drive repo. Bootstrap and focused reruns passed. |
| Identity/launch | Stage 2 and final focused gates passed. Local installation SUCCESS: build 0, npm link 0, four aliases installed. Local CLI smoke GREEN 8/8 with cwd preserved; sidecar mapping tested, live sidecar smoke not run. Manual input check pending with user. |
| Welcome/copy | Stage 3 and final focused gates passed, including the corrected health-hint copy/tests. README complete with upstream benchmark attribution preserved. Screenshot inspection passed at all three target sizes. |
| Workspace context | Stage 3 comprehensive gate passed, including 10 Git-context and seven hook tests. |
| Fork protection | Stage 4 GREEN: type checking and 179 tests across 17 suites passed. |
| Visual follow-up | COMPLETE locally. Stage 1: 139 tests/10 files plus typecheck. Stage 2: 320 tests/23 files, typecheck 0. Build/install 0, four wrappers, source PTY 10/10, built PTY 1/1, visual inspection, and final smoke 8/8 passed; cwd preserved. |
| Delivery | Local rebrand/follow-up complete, uncommitted; all processes stopped. User manual check remains open. Earlier full suite still FAIL: 6,509 passed, 14 failed, four skipped; no rerun. Full-test/push gate BLOCKED; no commit, remote change, or push. |

Use separate test-design, test-running, and failure-analysis agents where available. Stop progression at failed gates; document blocked checks without calling them passed. The architecture agent owns this record and `PRODUCT.md`; the handoff agent owns a separate handoff that references these documents and includes suggested skills. No tests are needed for these two documentation-only additions.

## Deferred Work

Core identifier/environment/storage migrations, fork distribution/installers and release infrastructure, public launch, and original features remain deferred. Replace the temporary docs URL before launch. Apply YAGNI and keep this stage scoped; do not turn a surface rebrand into a runtime rewrite.

## Deep Network Audit: Scope and Evidence

Date: 2026-08-31. Status: **final controlled verification complete; security findings remain open**. All five audit documents below exist and were read; the verification record now includes final relocated-suite results. This status covers the documented controlled audit, not complete runtime/network coverage or release clearance. Earlier rebrand and visual-follow-up results above remain historical evidence with their original limits.

- Scope is source/test/docs audit only, including read-only inspection of existing distribution artifacts. Production fixes, connector migration, provider replacement, release publication, and changes to remote services are not authorized by this audit. No remediation was performed; proposed fixes and ownership requirements in the audit documents remain proposals for a later approved task.
- Identity target remains **h0x-cli by PAVii.Ai**, website **pavii.tech**, with the fuller identity register in [PRODUCT.md](../../PRODUCT.md). Branding does not establish ownership of inherited endpoints, accounts, credentials, or connector infrastructure. Do not relabel third-party services as fork-owned.
- Upstream PostHog/Sentry reporting remains disabled through the existing `PLACEHOLDER` sentinels. Preserve the disabled application-update path. Neither decision means that all outbound networking is disabled: configured providers, tools, MCP servers, downloads, and build infrastructure require separate assessment.
- All generated audit artifacts, temporary data, caches, logs, and reports must stay under `G:\h0xi\atomic-agent` or another explicitly approved G-drive folder. Reading installed tools from C is permitted; writing project artifacts there is not. Do not include secret values in documentation.
- This architecture agent owns only this appended entry in `docs/rebrand/decisions.md` and performs read-only inspection plus documentation editing. It runs no tests, builds, or network requests. The parent owns findings, endpoint ledger, and ownership; other audit agents own verification and dependencies/build analysis. A separate handoff agent owns `handoff.md`; this entry neither edits nor replaces it. This narrower assignment supersedes the older architecture-agent ownership note above for the current audit.

### Evidence Rules

Distinguish a literal URL or dependency in source from a reachable execution path, effective configuration, and an observed request. Record defaults separately from environment/config overrides and from the values actually resolved in a specific run. A disabled sentinel or guard is source evidence about that path, not proof of a process-wide absence of traffic. A configured endpoint does not prove contact or ownership; passing mocked tests do not establish live-network behavior. Absence of interception events covers only the exercised transports and process tree, not every possible subprocess or SDK. Preserve untested paths and uncertain ownership explicitly.

Use the local knowledge graph first for code discovery, then inspect source to confirm behavior. The graph returned no entries for the HTTP/search files during this review, so those paths were located and read directly. Graph coverage is navigation evidence, not an exhaustive network inventory. Do not infer an effective production setting from a test fixture, a historical report, or an unexercised default. Detailed claims, severity, endpoint classifications, commands, results, and gaps belong in the audit documents below rather than being duplicated here.

### Audit Codebase Map

Repository-relative entry points below identify review boundaries, not verified network outcomes.

| Area | Entry points and audit boundary |
| --- | --- |
| Config and runtime | `src/config/load-config.ts`, `src/config/config-cache.ts`, and `src/runtime/bootstrap.ts`: configuration resolution, runtime construction, provider/reporting wiring, and process environment. Follow resolved values into each consumer. |
| Telemetry and error reporting | `src/analytics/posthog-config.ts`, `src/analytics/analytics-client.ts`, `src/error-reporting/sentry-config.ts`, and `src/error-reporting/sentry-client.ts`: disabled sentinels versus client construction and dispatch. Retained SDK dependencies or endpoint literals alone do not establish ingestion. |
| MCP transports and subprocesses | `src/mcp/mcp-manager.ts` and `src/mcp/mcp-client.ts`: lifecycle and `McpClient.buildTransport`. Stdio construction copies every string-valued `process.env` entry, then overlays per-server environment keys; the source explicitly documents no environment filtering. Separately assess HTTP/SSE transports, configured headers, and child-process networking; do not claim actual secret transmission from inheritance alone. |
| Cloud providers | `src/llm/provider/registry/register-built-in-providers.ts`, `src/llm/provider/registry/provider-registry.ts`, `src/llm/provider/verify/verify-provider-key.ts`, and `src/runtime/llm-fallback-seam.ts`: provider registration/configuration, verification requests, fallback selection, and subscription CLI delegation. Trace each adapter's effective URL, headers, and payload independently of reporting settings. |
| Curl HTTP, fetch, and search | `src/tools/os/http-request.ts`, `src/tools/os/http-request-fetch.ts`, `src/tools/os/web-fetch.ts`, `src/tools/os/web-fetch-ssrf-guard.ts`, and `src/tools/os/web-search/transport/search-http.ts`: subprocess transport, DNS/host controls, redirects, retries, and request data. `src/tools/os/web-search/providers/search-orchestrator.ts` owns search-provider selection. In-process fetch interception alone cannot cover curl execution. |
| Updates and downloads | `src/update/check-app-update.ts` and `src/update/run-app-update.ts`: disabled app updater. Separately inspect `src/local-llm/download-file.ts`, `src/local-llm/model-installer.ts`, and `src/local-llm/backend-installer.ts`; disabling app updates does not disable model/backend acquisition. |
| Dependencies, build, and CI | `package.json`, `package-lock.json`, `scripts/fetch-assets.ts`, `scripts/bundle-sea.ts`, `scripts/package-bundle.ts`, `scripts/install.sh`, `scripts/install.ps1`, and `.github/workflows/{test,release}.yml`: installation/build downloads, dependency scripts, signing, artifacts, and release destinations. Treat CI activity separately from installed-runtime traffic; workflow source does not prove execution or available secrets. |
| Explicit source/dist audit suites | `audit/vitest.config.ts` selects `audit/telemetry.network-audit.test.ts` and `audit/provider-loopback.network-audit.test.ts` outside default discovery. Pure-source audit tests remain under `src/`. Root Vitest/TypeScript configuration is unchanged; final discovery/import validation is static, not clean-CI execution. See verification for exact commands and audit-file compiler scope. |

### Audit Deliverables

The parent findings, endpoint ledger, and ownership record are available, along with the verification and dependency/build reports. [Findings F01-F03](../network-audit/findings.md#findings-by-priority) record high-severity HTTP/search redirect credential forwarding, diagnostic credential exposure, and download token-routing defects reproduced synthetically. Passing characterization tests demonstrate the defects, not remediation or a safety verdict; no historical exfiltration or real-service receipt was established. Detailed findings and proposed fixes remain in that report.

The [final relocated verification](../network-audit/verification.md#final-relocated-verification) is the canonical source for commands, distinct test counts, isolation, source-versus-existing-dist evidence, and process completion. The runner reports successful separate source and existing-dist executions under the explicit audit config, preserving mocked telemetry and bounded native `127.0.0.1` provider receipt tests. Both production and explicit audit-file noEmit checks passed; the latter's file listing confirms every audit test, including the relocated files, was included. Static discovery/import checks passed with root configs unchanged; this does not establish a clean-CI run. No external contacts, builds, or dist modifications occurred in these checks, and all recorded runner processes completed with exit 0 and no timeout, with no matching direct Node/esbuild children remaining. This is runner evidence, not execution by this architecture agent.

Use the verification record's linked `final-test-summary.json` for deduplicated results; earlier paths and rerun logs remain historical and must not be added to the final distinct count. Mock interception and a local fixture's receipt are distinct evidence states, and neither proves delivery to a real provider. Actual loopback receipts cover the tested provider wrappers, not complete dist registry, streaming, or lifecycle behavior. The [dependency/build report](../network-audit/dependencies-and-build.md) supplies static installation, release, upload, signing, evaluation, and skills evidence; it does not establish that those paths executed.

Uncontained runtime and live probes remain explicit verification gaps: full TUI/bootstrap/CLI/sidecar lifecycles, browser and external connector process-tree traffic, real-runtime packet capture, and authenticated service receipt/ownership were not established. Broader dist behavior and MCP reconnect/re-enable, HTTP/SSE authentication, actual subprocess environment transmission, and stderr redaction remain unverified as detailed in the verification record. The passive snapshot found no product CLI root, so its empty connection list cannot demonstrate a quiet running application. Completed contained loopback tests do not close those broader gaps. Reporting remains disabled, connector migration and remediation remain unperformed, and the 14 prior full-suite failures remain push/release blockers; they were not rerun or cleared by audit passes. Keep exact remaining coverage in verification rather than duplicating changing test totals here.

| Document | Owner and purpose |
| --- | --- |
| [Findings](../network-audit/findings.md) | Parent: consolidated risks, evidence, and proposed remediation. |
| [Endpoint ledger](../network-audit/endpoint-ledger.md) | Parent: destinations, triggers, payloads, and source/effective/observed distinctions. |
| [Ownership](../network-audit/ownership.md) | Parent: fork, upstream, third-party, and user-configured ownership boundaries. |
| [Verification](../network-audit/verification.md) | Verification agent: actual commands, isolation, results, failures, and untested transport coverage. |
| [Dependencies and build](../network-audit/dependencies-and-build.md) | Dependency/build audit agent: package, installer, download, signing, and CI analysis. |

Documentation verification for this entry is limited to reading the existing architecture/identity records, graph/source inspection, and reviewing the appended text. No current-audit test, build, network observation, or complete-audit claim is made by this agent.
