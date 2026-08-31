# Full-suite failure plan

Date: 2026-08-31. Owner: failure-analysis agent. Status: PUSH BLOCKED; scope-expansion approval pending. Diagnosis only; no production/test fixes or additional tests executed by this agent.

## Run and evidence limits

- [Full log](G:/h0xi/atomic-agent/.local/reports/rebrand-stage5-full.log), [JSON assertions](G:/h0xi/atomic-agent/.local/reports/rebrand-stage5-full.json): exit 1; 618 files, 608 passed, 10 failed; 6527 tests, 6509 passed, 14 failed, 4 skipped; 300.81 seconds.
- JSON top-level suite counts include nested suites; they are not the file count. The inventory below comes from failed assertion records, not summary guesses.
- All 10 failing test files are unchanged versus HEAD. Targeted diff also confirms the inspected backend installer/variant resolver, skill script runner, readiness/key resolver, terminal discovery and uninstall guard sources are unchanged. Package changes are branding/metadata/bin aliases, not dependencies or test scripts.
- No rebrand-specific regression identified. Unchanged files alone do NOT prove a clean-baseline reproduction: shared dependencies/environment can affect them. Only the concurrency failure has explicit upstream CI baseline documentation; the remaining classifications combine unchanged-source evidence with inspection/probes, as labeled below.
- The previously CI-excluded local-models-orchestrator-auto-update suite reports 8 passed here. No corresponding unhandled-error section was found in this run; do not add it to the 14 failures.
- No exclusions, assertion weakening, new skips, or accepted failures are authorized. Existing four skips are reported, not newly introduced or approved by this analysis.

## Prioritized inventory: 10 files, 14 failures

### 1. Uninstall safety: 1 failure, product-level blocker

[uninstall-targets.test.ts:109](G:/h0xi/atomic-agent/src/uninstall/uninstall-targets.test.ts:109): `isSafeToRemove refuses a one-segment system directory`; `/usr` is accepted instead of rejected.

Evidence: confirmed unchanged guard/test; direct read-only Node path probe shows Windows resolves `/usr` to `G:\usr`, split segments `["G:", "usr"]`. The guard in [uninstall-targets.ts](G:/h0xi/atomic-agent/src/uninstall/uninstall-targets.ts) counts the drive as a directory. `C:\Windows` likewise has two segments and passes the shallow-directory condition despite the source comment explicitly intending rejection. This is a pre-existing Windows safety defect in the predicate, not merely a POSIX test fixture. No destructive operation was attempted; broader exploitability was not assessed.

Plan: requires explicit product-scope approval. Count path depth below the parsed filesystem root, preserving root/home rejection and existing intended home-descendant behavior. Cover Windows drive roots and shallow directories, UNC share roots/shallow directories, POSIX roots/shallow directories and legitimate deeper targets. Do not change expected rejection to acceptance, skip Windows, or alter real filesystem contents. Until approved and verified this cannot be cleared with tests/environment alone.

Rerun after approval: entire uninstall-targets test file and related uninstall safety tests; then typecheck and full suite.

### 2. Sidecar FIFO: 1 failure, CI-known baseline, cause unresolved

[send-message-concurrency.test.ts:139](G:/h0xi/atomic-agent/src/sidecar/send-message-concurrency.test.ts:139): `serialises two rapid send_message calls FIFO without crossing state`; observed `[m1,m2,m3]`, expected `[m1,m2]`.

Evidence: confirmed unchanged test and exact match to [.github/workflows/test.yml:110](G:/h0xi/atomic-agent/.github/workflows/test.yml:110), which documents this failure on unmodified main and issue #203. CI calls it a sidecar behavior question, not a timing flake. The stub ignores reflection-prefixed sessions but labels other completion calls as user-message inferences. Whether the third call is legitimate auxiliary work has NOT been proven.

Plan: instrument the focused test's completion stub to identify each call's purpose/session/slot before changing expectations. If m3 is legitimate auxiliary work, isolate that response in the stub and keep strict two-user-turn FIFO/state assertions. Otherwise return to parent for a separately approved runtime fix. Do not merely accept m3, raise timeouts, or copy the upstream exclusion.

Rerun after approval: entire concurrency test plus sidecar send-message/turn-order tests. No generic test-only fix is yet justified.

### 3. Provider readiness: 4 failures, environment leakage

[local-backend-readiness.test.ts](G:/h0xi/atomic-agent/src/tui/local-backend-readiness.test.ts) fails these `isCloudTextProviderReady` cases with true instead of false:

- Line 164: `still refuses a keyless remote entry that is not CLI-backed`.
- Line 214: `does not treat a keyless remote openai-compatible entry as ready`.
- Line 239: `does not treat keyless Ollama Cloud as ready`.
- Line 269: `does not treat a keyless LAN openai-compatible entry as ready`.

Evidence: unchanged tests/readiness/resolver. Current diagnostic process has OPENAI_API_KEY present; OPENAI_COMPAT_API_KEY and ATOMIC_AGENT_OPENAI_API_KEY absent (values never printed). [resolve-llm-api-key.ts](G:/h0xi/atomic-agent/src/config/resolve-llm-api-key.ts) intentionally consults these for openai-compatible entries. Test setup clears OPENROUTER_API_KEY only, leaving its supposedly keyless fixtures exposed. Inherited-runner leakage is strongly supported; the completed runner's exact environment was not captured by this agent.

Plan: test-scoped vi.stubEnv of all three openai-compatible fallback keys to undefined, restored via vi.unstubAllEnvs; preserve explicit-key and provider-specific-key tests. An isolated runner can also remove these keys from its child environment, never from the user's persistent environment. Do not change production readiness semantics.

Rerun: whole readiness test file and API-key resolver tests, with parent environment keys preserved outside the test process.

### 4. Bash selection: 2 failures in 2 files, likely environment

- [skill-script-runner.test.ts:100](G:/h0xi/atomic-agent/src/skills/skill-script-runner.test.ts:100): `runs a bash script by .sh extension`; exit 1 instead of 0.
- [skill-tools.test.ts:126](G:/h0xi/atomic-agent/src/tools/skill/skill-tools.test.ts:126): `skill.run_script auto-approves the read-only gog setup check`; error instead of ok.

Evidence: both fixtures write shell scripts; the runner invokes bare `bash` with the Windows script path. The first fixture explicitly uses LF, not CRLF. Read-only Get-Command bash -All resolves C:\Windows\system32\bash.exe (WSL shim) before C:\Program Files\Git\bin\bash.exe. Prior appending of Git usr/bin fixed ls but does not correct this ordering. Exact failing subprocess stderr is not present in the assertion output, so the shared cause remains strongly inferred pending rerun.

Plan: child-test-process PATH ordering: pinned G Node runtime, then installed Git bin before System32; retain Git usr/bin for ls. Preserve the remaining PATH and keep TEMP/TMP/state/artifacts on G. No C writes, persistent PATH change, shell-runner production change, or approval-policy relaxation. Check resolved bash and focused failures first.

Rerun: both entire test files plus the previously affected bootstrap shell-category integration.

### 5. PDF canvas isolation: 2 failures, confirmed dependency leakage mechanism

[pdf-extractor.canvas-warnings.test.ts](G:/h0xi/atomic-agent/src/tools/os/read-document/extractors/pdf-extractor.canvas-warnings.test.ts):

- Line 202: `sanity-checks that the sandbox really lacks @napi-rs/canvas`; RESOLVED instead of ABSENT.
- Line 214: `emits the canvas warnings without the fix (ablation)`; text extraction succeeds but missing-canvas warning does not occur.

Evidence: unchanged test copies pdfjs into tmpdir but does not block ancestor node_modules resolution. With G-repository-local TMP, the sandbox remains below this checkout. A read-only createRequire probe anchored under G:\h0xi\atomic-agent\.local\tmp resolves canvas from G:\h0xi\atomic-agent\node_modules\@napi-rs\canvas\index.js. This defeats the no-canvas premise, consistent with both reported failures; the product extraction path itself succeeds.

Plan: preferred environment-only option, subject to explicit folder approval: use an isolated G-drive temporary root outside the checkout's dependency ancestry and ensure canvas cannot resolve from that root or NODE_PATH. Do not switch to C TEMP. If retaining repository-local TMP is required, make the test sandbox explicitly deny canvas resolution/loading (for example, a nearest shadow package with exports blocked); this fixture alternative needs focused verification because it simulates unavailability rather than physical absence. Preserve the independent absence probe, warning-producing ablation, text marker, fixed-path warning suppression, and Module._load restoration assertions. Do not uninstall repo dependencies or remove the ablation assertions.

Rerun: complete canvas-warnings file and PDF extractor tests under the final chosen G TMP configuration.

### 6. PATH fixture: 1 failure, confirmed platform assumption

[open-terminal-window.test.ts:130](G:/h0xi/atomic-agent/src/tui/open-terminal-window.test.ts:130): `isOnPath finds a binary that exists on PATH`; false instead of true.

Evidence: unchanged test supplies `sh` and `/nope:/bin:/usr/bin`, while unchanged implementation splits by native path.delimiter (`;` on Windows). Neither that separator nor those directories is a portable fixture.

Plan: use basename(process.execPath) as the known executable and build PATH from a nonexistent fixture directory plus dirname(process.execPath), joined with path.delimiter. Keep missing/empty PATH assertions. No terminal-launch production change.

Rerun: whole open-terminal-window test file.

### 7. Filesystem scope symlink: 1 failure, inferred Windows fixture defect

[fs-approval-scope.test.ts:71](G:/h0xi/atomic-agent/src/tools/os/fs-approval-scope.test.ts:71): `a symlink inside the workspace that points outside is NOT workspace`; second assertion returns outside instead of home.

Evidence: unchanged fixture creates link-home without an explicit symlink type BEFORE its directory target exists. Windows can create a file-type symlink for this missing target, so subsequent directory traversal cannot resolve as intended. The first outside assertion passes; failed resolution remains fail-closed as outside. No actual fixture recreation was performed.

Plan: create the intended home/sub directory first and specify directory symlink type explicitly for both directory links. Keep dedicated dangling-file-link tests unchanged. Verify workspace/home/outside classification; never relax production realpath/approval boundaries to accommodate an invalid fixture.

Rerun: complete fs-approval-scope file and related filesystem approval/security tests.

### 8. Child termination: 1 failure, platform-specific signal assertion

[stream-cli-completion.test.ts:232](G:/h0xi/atomic-agent/src/llm/provider/subscription-cli/stream-cli-completion.test.ts:232): `force-kills a child that traps SIGTERM instead of orphaning it`; alive(pid) is false immediately after iterator.return, expected true.

Evidence: unchanged test assumes POSIX trapping of SIGTERM. On Windows termination does not provide that trapping behavior; the reported child is already gone, which satisfies the no-orphan intent. No extra child process was launched to reproduce this diagnosis.

Plan: retain the intermediate alive assertion on POSIX only; Windows must verify termination rather than survival. Keep bounded eventual-death and cleanup assertions on all platforms. If cross-platform escalation coverage is required, add a deterministic mocked-kill/timer test separately; do not add a blanket integration-test skip or weaken eventual cleanup.

Rerun: complete stream-cli-completion test file; preserve POSIX escalation coverage in CI.

### 9. Backend variant: 1 failure, inferred hardware-dependent fixture

[backend-installer.test.ts:480](G:/h0xi/atomic-agent/src/local-llm/backend-installer.test.ts:480): `updates on a variant change even though the tag is unchanged`; updateAvailable false instead of true.

Evidence: unchanged test mocks Windows/x64, installs a CUDA 13.3 asset, and supplies a release containing Vulkan only. [windows-backend-variant.ts](G:/h0xi/atomic-agent/src/local-llm/windows-backend-variant.ts) still performs cached real nvidia-smi detection. If it selects CUDA, the mocked release has no matching desired asset and the installer returns no available update. Real GPU selection in the failed worker was not captured; cause remains inferred, not confirmed.

Plan: deterministically stub the desired download asset (or driver probe plus resetWindowsBackendAssetCache) for this test, ensuring it differs from the installed asset and is present in the mocked release. Restore mocks/caches afterward. Correct the contradictory test comment. Do not change backend selection/update behavior merely to match this machine.

Rerun: whole backend-installer file and windows-backend-variant tests.

## Approval and execution sequence

1. Parent obtains user scope approval; this document itself authorizes no fixes. Keep push/install advancement gated as directed by parent.
2. Quick narrow lane: Bash process PATH (2 failures), provider-key isolation (4), PDF sandbox environment/isolation (2). Preserve G-only outputs and existing TERM/COLORTERM settings. Record exact environment setup without secrets.
3. Fixture lane: portable PATH (1), directory symlinks (1), Windows signal semantics (1), deterministic backend variant (1). Verify each changed area before continuing.
4. Independent blockers: uninstall safety predicate (1) requires approved product fix; CI-known sidecar m3 (1) requires call-purpose evidence before deciding test versus product change. These cannot be hidden by the twelve environment/fixture repairs.
5. Runner, not this analyst, executes the specified focused files with G:\h0xi\atomic-agent\.local\runtime\node-v25.7.0-win-x64\node.exe and the existing Vitest entrypoint, reports exit codes/assertions, then tsc. After all approved focused repairs pass, rerun the FULL suite with no exclusions and bail 0; retain G log/JSON outputs and require exit 0 with no unhandled errors. Existing full-suite failure evidence remains retained.

No automatic clean-baseline rerun, full test rerun, dependency removal, source/test edits, product scope expansion, waiver, or push was performed by the failure analyst. Manual PTY/input verification remains a separate pending user check; no further PTY debugging was undertaken.
