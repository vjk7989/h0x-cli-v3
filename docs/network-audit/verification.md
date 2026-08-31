# Network audit verification

Independent test runner, 2026-08-31. Worktree contains pre-existing changes;
this runner owns only this record and ignored `.local/network-audit/reports/`.
No production edits, installation, build, real application launch, or external
service calls are authorized. The previous full-suite baseline remains a blocker.

**Result: 146 executed tests passed across 17 unique files; production noEmit
and explicit audit-file noEmit passed. This is NOT a security-safe verdict. Characterization passes reproduce
open vulnerabilities and upstream attribution.** Source and existing-dist
telemetry and provider loopback cases ran in separate processes. All 19 runner processes exited 0,
without timeout, and completed; final process checks are recorded below.

## Remediation follow-up, F01-F03

Remediation agents reported focused source-level fixes for F01-F03 on
2026-09-01. This documentation update did not rerun the commands below and made
no external service calls; it records the received results so the architecture
record and audit docs point at the current source state.

| Area | Reported focused result | Scope |
| --- | --- | --- |
| F01 redirect credentials and allowlists | `src/tools/os/http-redirect-remediation.test.ts` passed 16 tests after expectation alignment. The broader F01 focused command was reported with expectation mismatches first; failure analysis recommended keeping stricter cross-origin `307`/`308` body rejection and applying allowlist checks before the next redirect request. | Raw HTTP and search HTTP redirect behavior, credential header stripping, same-origin preservation, body-forwarding refusal, and redirect-destination allowlists. |
| F02 download token routing | `src/local-llm/download-file.test.ts` plus `src/local-llm/download-file.network-audit.test.ts` passed 22 tests. | Parsed trusted HTTPS origins, query/path/userinfo/lookalike rejection, insecure URL rejection, and manual per-hop redirect token selection. |
| F03 diagnostics redaction | Nine focused files passed 149 tests: MCP errors, trace recorder/sink, approval gate, Telegram approval bridge, HTTP request, HTTP redirect audit, conversation-turn prompt rendering, and shell diagnostics. | Credential-like text redaction at diagnostic/prompt/trace boundaries while preserving execution inputs. |

These remediation passes do not establish a clean full-suite run, build/install
verification, real TUI lifecycle packet capture, authenticated service receipt,
or historical-traffic absence. They also do not close remaining audit items such
as MCP environment inheritance, connector identity migration, automatic
background checks, release packaging, and reporting policy.

## Final relocated verification

After analyst approval, the writer moved the two dist-dependent files to
`audit/telemetry.network-audit.test.ts` and
`audit/provider-loopback.network-audit.test.ts`, correcting relative imports.
`audit/vitest.config.ts` is standalone and includes only those two files.
The four pure-source audit files remain under `src/`. Default Vitest and root
TypeScript configuration were not edited. No shared dist rename/delete, build,
skip-if-missing or source substitution was used.

Final commands use the same pinned runtime, sanitized runner, one-worker
Vitest flags and JSON reporting described below:

| Final label | Arguments before common Vitest flags | Result and completion |
| --- | --- | --- |
| `final-source-audit` | `node_modules/vitest/vitest.mjs run --config audit/vitest.config.ts -t source` | 2 files, 4 passed, 4 complementary cases filtered; 1.26 s; PID 18856, exit 0 |
| `final-dist-audit` | `node_modules/vitest/vitest.mjs run --config audit/vitest.config.ts -t existing-dist` | 2 files, 4 passed, 4 complementary cases filtered; 1.25 s; PID 22984, exit 0 |
| `final-audit-typecheck` | `node_modules/typescript/bin/tsc -p .local/network-audit/reports/tsconfig.audit-final.json --noEmit --listFiles` (no Vitest flags) | all 6 audit files explicitly listed; no diagnostics; PID 28960, exit 0 |
| `final-discovery` | `.local/network-audit/reports/verify-final-discovery.mjs` (no Vitest flags) | static checks passed; PID 29816, exit 0 |

The final temporary tsconfig extends root, overrides rootDir to the repository
root, explicitly lists both moved files plus all four source audit files, and
uses empty include/exclude arrays with noEmit=true/incremental=false. The
compiler's `--listFiles` output confirms all six are present, not silently
omitted. The original temporary tsconfig and its logs remain historical.

`final-discovery.json` records TypeScript-AST inspection of root include globs,
matching via Node's `path.matchesGlob`, exclusion of both moved paths, absence
of old paths, and zero direct dist imports or nonliteral dynamic imports in
the four remaining source audit tests. `git diff --exit-code --
vitest.config.ts tsconfig.json` passed. **This is static discovery/import
validation, NOT a clean-CI run.** Shared dist was never moved or removed.

Final distinct count remains **146 tests across 17 files**, consisting of
118 existing checks, 20 source audit cases and 8 relocated source/dist cases.
`final-test-summary.json` uses the final relocated runs instead of the earlier
telemetry/loopback runs and deduplicates passed file/fullName identities.
Historical executions are preserved, not added again to the distinct count.

## Isolation and selection

- Runtime: `.local/runtime/node-v25.7.0-win-x64/node.exe`.
  `runtime.process.json` records `--version`: `v25.7.0`, PID 10896, exit 0.
- Runner: `.local/network-audit/reports/run-verified.ps1`. It clears the child
  environment and restores only OS execution fields, a bounded PATH, explicit
  temporary/state/cache locations, CI, and no-color settings. No inherited
  service keys, proxies, NODE_OPTIONS, or persistent user environment changes.
- TEMP, TMP, TMPDIR: `G:\h0xi\atomic-agent\.local\tmp`.
- ATOMIC_AGENT_STATE_DIR: `G:\h0xi\atomic-agent\.local\network-audit\state`.
- npm cache: `.local/network-audit/npm-cache`; process records and logs:
  `.local/network-audit/reports`. No npm invocation or lifecycle scripts.
- Tests are selected by explicit filename after reading their transport seams.
  Initial runs use mock-based containment; the bounded follow-up uses an actual
  ephemeral IPv4 loopback listener with a strict injected fetch guard. Neither
  is an OS firewall or packet-capture claim.
- Existing Vitest setup only creates a state directory if the dedicated state
  environment variable is absent; it is explicitly provided here.

| Existing selected file | Transport isolation reviewed |
| --- | --- |
| `src/analytics/analytics-client.test.ts` | Hoisted PostHog constructor mock; all sending clients use fake SDK; production-mode placeholder case also stubs global fetch. |
| `src/error-reporting/sentry-client.test.ts` | Sending clients receive fake fetch; no-injection case stays behind Vitest guard; production-mode placeholder case stubs global fetch. |
| `src/update/check-app-update.test.ts` | Global fetch rejected/mock-counted; injected fetch mock; actual implementation unconditionally rejects. |
| `src/update/run-app-update.test.ts` | Hoisted spawn mock; executable update cases reject; builder only returns strings and explicit fixture environments. |
| `src/cli/update-command.test.ts` | Direct function tests, not CLI process launch; checker/installer/confirm injected; real-default cases mock fetch and spawn and supply repository. |
| `src/llm/provider/openrouter/fetch-openrouter-chat-catalog.test.ts` | Every API refresh has global fetch replaced; fresh module imports reset cache for fallback/coalescing assertions. |
| `src/llm/provider/aimlapi/fetch-aimlapi-chat-catalog.test.ts` | Every API refresh has global fetch replaced; fake JSON or rejection, no fallback transport. |
| `src/tui/providers/providers-orchestrator.test.ts` | Only the 3 `prefetchCloudCatalogs` cases selected. Global fetch mocked before fresh orchestrator import; fake bus/runtime; cold, warm, failed and repeated refresh paths. No TuiApp launch or real startup. |
| `src/mcp/mcp-manager.test.ts` | Entire McpClient module replaced by FakeMcpClient before manager import; start, disabled server, disable, live add/remove, shutdown and isolated failures use in-memory callbacks. |
| `src/mcp/mcp-sampling-handler.test.ts` | Injected fake completion function in every test; production handler imports LLM/SDK types only. No actual LLM request. |
| `src/channels/telegram/telegram-channel.test.ts` | Only 12 reviewed lifecycle cases selected: initial 9 plus enable, disable and owner-change restart. Each uses explicit fake bot factory/API, runtime and lock. Native grammy factory is lazy and never selected; no actual polling. Temporary persistence stays under the G temp directory. |

## Execution history

All commands run from `G:\h0xi\atomic-agent` using the runner above. Vitest
commands use `--maxWorkers=1 --minWorkers=1 --reporter=default --reporter=json
--outputFile=.local/network-audit/reports/<label>.vitest.json --no-cache`.
The process JSON stores the exact executable, argument array, timestamps, PID,
exit code, timeout flag, and completion status. No full-suite run is planned.
The table below preserves pre-relocation evidence. Its old telemetry/loopback
paths and earlier audit-file typechecks are superseded by the final relocated
verification above; those historical commands do not describe current layout.

| Label | Command arguments before common Vitest flags | Result | Process |
| --- | --- | --- | --- |
| `existing` | `node_modules/vitest/vitest.mjs run src/analytics/analytics-client.test.ts src/error-reporting/sentry-client.test.ts src/update/check-app-update.test.ts src/update/run-app-update.test.ts src/cli/update-command.test.ts` | 5 files, 61 passed, 0 failed; 2.04 s | PID 24476, exit 0, completed, no timeout |
| `source-http` | `node_modules/vitest/vitest.mjs run src/tools/os/http-redirect.network-audit.test.ts` | 1 file, 9 passed, 0 failed; 543 ms | PID 22424, exit 0, completed, no timeout |
| `source-telemetry` | `node_modules/vitest/vitest.mjs run src/analytics/telemetry.network-audit.test.ts -t "production telemetry source"` | 2 passed; 2 complementary dist cases filtered; 403 ms | PID 2940, exit 0, completed, no timeout |
| `dist-telemetry` | `node_modules/vitest/vitest.mjs run src/analytics/telemetry.network-audit.test.ts -t "production telemetry existing-dist"` | 2 passed; 2 complementary source cases filtered; 458 ms | PID 26468, exit 0, completed, no timeout |
| `source-mcp` | `node_modules/vitest/vitest.mjs run src/mcp/mcp-client.network-audit.test.ts` | 1 file, 4 passed; 639 ms | PID 23280, exit 0, completed, no timeout |
| `source-provider-download` | `node_modules/vitest/vitest.mjs run src/llm/provider/registry/provider-attribution.network-audit.test.ts src/local-llm/download-file.network-audit.test.ts` | 2 files, 7 passed; 1.76 s | PID 29964, exit 0, completed, no timeout |
| `existing-catalogs` | `node_modules/vitest/vitest.mjs run src/llm/provider/openrouter/fetch-openrouter-chat-catalog.test.ts src/llm/provider/aimlapi/fetch-aimlapi-chat-catalog.test.ts` | 2 files, 19 passed; 768 ms | PID 3188, exit 0, completed, no timeout |
| `existing-prefetch` | `node_modules/vitest/vitest.mjs run src/tui/providers/providers-orchestrator.test.ts -t "ProvidersOrchestrator.prefetchCloudCatalogs"` | 3 passed; 10 intentionally filtered; 2.42 s | PID 16500, exit 0, completed, no timeout |
| `existing-mcp-lifecycle` | `node_modules/vitest/vitest.mjs run src/mcp/mcp-manager.test.ts src/mcp/mcp-sampling-handler.test.ts` | 2 files, 23 passed; 808 ms | PID 22876, exit 0, completed, no timeout |
| `existing-telegram-lifecycle` | `node_modules/vitest/vitest.mjs run src/channels/telegram/telegram-channel.test.ts -t <telegram-filter-below>` | 12 passed; 25 intentionally filtered; 1.10 s | PID 29752, exit 0, completed, no timeout |
| `typecheck` | `node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` (no Vitest flags) | no diagnostics; about 7.48 s | PID 19416, exit 0, completed, no timeout |
| `source-provider-loopback` | `node_modules/vitest/vitest.mjs run src/llm/provider/provider-loopback.network-audit.test.ts -t "actual loopback receipt source"` | 2 passed; 2 complementary dist cases filtered; 983 ms | PID 4352, exit 0, completed, no timeout |
| `dist-provider-loopback` | `node_modules/vitest/vitest.mjs run src/llm/provider/provider-loopback.network-audit.test.ts -t "actual loopback receipt existing-dist"` | 2 passed; 2 complementary source cases filtered; 1.19 s | PID 31076, exit 0, completed, no timeout |
| `audit-test-typecheck` | `node_modules/typescript/bin/tsc -p .local/network-audit/reports/tsconfig.audit-tests.json --noEmit` (no Vitest flags) | all 6 audit files, no diagnostics; about 3.84 s | PID 19868, exit 0, completed, no timeout |

Exact Telegram `-t` filter (one argument):

```text
^TelegramChannel (starts up|emits down|stop\(\)|double-stop|non-fatal|registers a callback|re-binds|live-control surface (setEnabled|setOwnerUserId restarts))
```

The initial 28 writer cases passed (24 initial plus 4 bounded loopback follow-up).
Eight were later rerun at their final audit paths, without increasing the
distinct count. Existing tests contribute 118 passes. Complementary source/dist filters cover
all 4 telemetry and all 4 loopback cases across their separate commands;
their skipped counterparts are not missing tests. The 35 filtered existing tests
(10 provider-orchestrator and 25 Telegram) were deliberately not executed.

The HTTP audit file was reviewed before execution: `runCommand` and DNS
`lookup` are injected mocks; defaults are replaced by throwing module mocks;
global fetch is a throwing guard. Both mocked URLs use `.invalid`, credentials
are synthetic, and the public-shaped DNS address is only data. The guard call
count is asserted zero after each test. No curl or DNS subprocess is executed.

**The 9 HTTP passes confirm unsafe current behavior, not safety:** an initial
host allowlist does not constrain the redirect destination; HTTP 302/307
forward Authorization/Cookie/API-key headers cross-origin; successful and
failed request results expose those headers in `details.command`; search
HTTP 302/303/307/308 replay both credentials and a POST body cross-origin.

Other writer isolation and results:

- Telemetry: PostHog constructor and global fetch guarded before dynamic
  imports; VITEST removed and NODE_ENV=production for enabled/disabled cases.
  Both source and dist return null for the shipped placeholder configuration.
  Boolean comparisons prevent ingestion keys/DSNs appearing in diagnostics.
- MCP: real SDK Client with in-memory stdio JSON-RPC fixture; other transport
  constructors and global fetch forbidden. Synthetic canary booleans show
  ambient environment inheritance into the stdio constructor (not a spawned
  child); initialize exposes legacy identity and sampling capabilities but not
  the canary. RPC and isError failures retain credential-like text. These
  finding passes do not demonstrate environment isolation or redaction.
- Providers: production OpenRouter/AIML registry factories, fake loopback fetch
  (no socket), unary and SSE. Verifies synthetic prompt/tool-schema payload and
  provider-specific attribution; unrelated synthetic env text is absent.
  Current upstream OpenRouter identity and AIML source are characterized,
  not corrected. No embeddings or vision requests were exercised.
- Downloader: all four consulted GitHub/Hugging Face key aliases are overridden
  with synthetic values or unset. Fetch returns mock 401 before file I/O;
  write/rename/remove functions are forbidden. Three passes reproduce token
  attachment to an unrelated `.invalid` host when a trusted domain appears
  only in the URL query. This credential-disclosure finding remains open.
- Loopback follow-up: `audit/provider-loopback.network-audit.test.ts`
  binds node:http to `127.0.0.1` on port 0. An injected fetch allows only the exact
  fixture origin/path, rejects credentials/query/hash and an external `.invalid`
  probe before native fetch, forces redirect:error, and applies a 3-second abort
  bound. Global fallback fetch is forbidden; proxy variables must be absent.
  Source and existing-dist OpenRouter/AIML wrappers each sent one actual HTTP
  request whose synthetic key, body, attribution and reply were asserted at the
  receiver. OpenRouter attribution options match registry wiring, but this is a
  wrapper test, not a dist registry-factory test. Nested finally closes provider,
  listener and all connections. No external provider was contacted.

No focused assertion failed; no production fixes were made. Relocation reruns
verified the approved suite isolation change, not a failed assertion. Erdos
received status and diagnosed the separate parent baseline
harness failure before the parent corrected that script.

## Source and existing dist

Read-only inspection of existing `dist/` confirms the same relevant HTTP
branches as source: initial-host-only `hostAllowed`, unchanged headers on each
redirect hop, exposed `details.command` on both success and transport failure,
and search transport reuse of method/body/headers. Telemetry factory test-mode
and placeholder gates and unconditional update rejection also have matching
control flow in the inspected source and dist files. This is scoped manual
inspection, not whole-program equivalence or a fresh-build claim.

`.local/network-audit/reports/source-dist-inspection.json` records SHA-256,
size, and modification time for 14 inspected source/dist files. Existing dist
files were last written at 2026-08-31 13:19:27-29 UTC before these tests. This
runner did not rebuild, modify, or invoke an application entrypoint from dist.
The 2 independent mocked dist telemetry cases passed, followed by 2 actual
loopback receipt cases against existing-dist OpenRouter/AIML wrappers. Source
ran equivalent cases in a separate process; observed payload, attribution and
reply behavior matched. Dist provider registry wiring, SSE, embeddings/vision,
raw HTTP redirect behavior, MCP, downloader, catalog and lifecycle behavior
were NOT dynamically exercised; HTTP/update parity claims above remain limited
to inspected control flow.
The final hash comparison found all 14 inspected files unchanged; recorded in
`.local/network-audit/reports/source-dist-final-integrity.json`.

## Parent baseline status

Parent reported a baseline harness TypeError; Erdos diagnosed it before any
parent fix: `scripts/network-audit-baseline.mjs:79` accesses `.length` on a
nullable `hostAllowlist`. Config permits `string[] | null`, defaults to null,
and `hostAllowed` treats null as unrestricted but an empty array as deny-all.
Parent then reported applying the nullable-count/explicit-mode correction and
successfully rerunning the baseline script (exit 0), with output at
`.local/network-audit/reports/baseline.json`. This runner neither edited nor
reran that script. Its scope is parsed config plus selected audit-process
overrides, not fully merged settings of a running product process. Parent
reports HTTP enabled, approvalMode=never, hostAllowlist=null (unrestricted at
the hostname allowlist layer; SSRF and approval are separate controls).

Parent's passive CIM snapshot at 2026-08-31 19:31:07 +05:30 found no product
root CLI process: empty process tree and zero TCP entries are not evidence of
a running application being quiet. Real TUI startup/panel lifecycle traffic
and packet capture were not performed by this runner.
The earlier full-suite baseline blocker is separate and is not cleared by any
focused audit pass. A harness fix would not remediate the HTTP vulnerabilities.

## Limits

Source and dist must be evaluated independently without rebuilding dist.
Production tsconfig excludes test files; its successful check is separate from
the successful audit-file check. The final latter check uses ignored G-drive
`.local/network-audit/reports/tsconfig.audit-final.json`, extends the unchanged
root tsconfig with rootDir at the repository root, explicitly lists all 6 audit
files including both moved files, clears inherited include/exclude globs, and
sets noEmit=true/incremental=false. Dependencies and existing
dist declarations are resolved transitively. No files were emitted and no root
config was edited. Other existing test files were not typechecked by that scope.

Passing focused tests cannot clear the prior
baseline blocker or establish every provider, MCP, browser, startup, installer,
and external-service flow is isolated. Parent audit owns the architecture and
handoff records; this record supplies verification evidence only.
See [findings.md](findings.md), [endpoint-ledger.md](endpoint-ledger.md),
[ownership.md](ownership.md), and [dependencies-and-build.md](dependencies-and-build.md)
for the parent/analyst audit records rather than interpreting test totals as
a substitute for their open findings.

Mocked lifecycle coverage includes catalogs, warm-cache suppression, retry
after failure, initial MCP start, disabled-server skip, disable, live add/remove,
shutdown, sampling request shaping, and Telegram enable/disable/restart.
MCP explicit reconnect/re-enable, HTTP/SSE auth, actual subprocess environment
transmission, stderr redaction and full bootstrap/CLI/sidecar lifecycles remain
gaps. No browser, real TUI, remote MCP, Telegram bot or provider service was
launched. No packet-capture claim and no quantitative coverage percentage.

`.local/network-audit/reports/process-completion.json` records the final
completion sweep for this runner's PIDs and direct Node/esbuild children;
this is process cleanup evidence, not product network-quiet evidence.
At 2026-08-31 14:15:04 UTC, all 19 recorded processes had completed with exit 0
and no timeout, and no matching direct Node/esbuild process remained.
`.local/network-audit/reports/test-summary.json` contains machine-readable
per-command counts derived from the Vitest JSON reports.
Use `final-test-summary.json` for the final distinct count after relocation;
the original `test-summary.json` remains pre-relocation evidence.
