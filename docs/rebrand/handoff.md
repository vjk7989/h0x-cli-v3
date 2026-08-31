---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up.
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
---

# Rebrand Remediation Handoff

## Next-session focus

Continue the post-audit rebrand hardening one area at a time. The September 1
remediation session implemented and focused-tested the first three audit blockers:
F01 redirect credential/body forwarding, F02 downloader token routing, and F03
diagnostic redaction. Next work should verify broader gates, update the canonical
audit/architecture records with the final remediation state, then move to network
defaults, subprocess credential access, first-party connector identity, and the
reporting decision. Identity target remains **h0x-cli by PAVii.Ai**, website
**pavii.tech**.

Finalized on 2026-08-31 after the parent's final evidence signal. All five audit
reports exist. Audit completion is limited to the documented static and synthetic
evidence; real runtime capture and authenticated remote probes remain blocked.
Final relocated verification, including bounded native loopback receipt, passed;
no loopback test remains pending. Production and explicit audit-file noEmit checks
passed, and all recorded runner processes completed successfully without timeout.
Consult [final verification](../network-audit/verification.md#final-relocated-verification)
for authoritative results and distinct counts; historical runs and relocation
reruns must not be added together.

Updated on 2026-09-01 for the first remediation pass. This handoff update made
no external service calls and did not run tests itself; it summarizes the current
session state from local context and subagent results.

## Remediation status

F01 redirect handling is implemented in the HTTP fetch and search HTTP paths.
The intended policy is stricter than the original audit characterization:
same-origin `307/308` may preserve body and sensitive headers, cross-origin
`301/302/303` drops body and strips credential-like headers, and cross-origin
`307/308` with a body is refused instead of forwarding request data. Redirect
hops are checked against the configured host allowlist before issuing the next
request. Focused evidence reported by runner/failure-analysis agents:
`80 passed, 6 failed` before assertion fixes, then the remediation-focused
test file passed (`16 passed`), and the baseline HTTP/search suite remained
green in later F03 coverage.

F02 downloader token routing is implemented with parsed trusted HTTPS origins
instead of substring matching. GitHub and Hugging Face tokens are selected only
for trusted parsed hosts and are dropped for query/path/userinfo/lookalike
matches and insecure `http:` URLs. Manual redirect behavior is covered, including
trusted-to-untrusted token dropping and untrusted-to-trusted token selection only
after the redirect target is parsed. Focused evidence: downloader suite passed
with `22 passed, 0 failed`.

F03 diagnostics redaction is implemented through a shared security sanitizer and
applied to HTTP diagnostics/approval previews, curl error details, MCP error
scrubbing, shell result summaries/details, prompt-rendered conversation turns,
and trace recorder events. The sanitizer preserves execution inputs internally
and redacts only at diagnostic/persistence/display boundaries. Focused evidence:
F03 suite passed with `149 passed, 0 failed`.

Current local diff includes production and test changes in HTTP request/redirect
code, search transport, downloader, MCP errors, shell diagnostics, conversation
turn rendering, trace recorder/events, sidecar/CLI/TUI formatting surfaces, and
`src/security/redact-secrets.ts`. Inspect the actual diff before building on it;
this document is a compact pointer, not a replacement for review.

## Source records

- [Findings](../network-audit/findings.md): prioritized defects, evidence limits,
  baseline context, and proposed remediation.
- [Endpoint ledger](../network-audit/endpoint-ledger.md): recipients, triggers,
  payloads, and distinctions between static, mocked, loopback, and remote evidence.
- [Ownership](../network-audit/ownership.md): identity boundaries, service/account
  requirements, and decisions needed from the owner after the audit.
- [Verification](../network-audit/verification.md): authoritative commands, final
  test counts, typecheck scope, source/dist checks, process cleanup, and open gaps.
- [Dependencies and build](../network-audit/dependencies-and-build.md): dependency
  hooks, upstream release uploads, installers, eval, skills, and history limits.
- [Architecture record](decisions.md): decisions and codebase map, including the
  deep audit entry and completed readability/theme follow-up. Update it after
  final remediation verification rather than duplicating architecture detail here.
- [Product register](../../PRODUCT.md) and [AGENTS.md](../../AGENTS.md): approved
  identity, compatibility boundaries, G-drive storage rules, and engineering gates.
- [Failure plan](failure-plan.md): prior 14 full-suite failures across 10 files;
  these remain push/release blockers until explicitly resolved or superseded by
  a complete rerun. Focused remediation passes do not clear the release gate.

## Evidence and constraints

The original audit scope was audit, tests, and documentation only. The later
remediation session did edit production code for F01-F03, but did not perform
connector or identity migration, real service calls, account/token changes,
installation, build, push, or release. Preserve existing worktree changes; do
not revert unrelated user or agent work.

The repeatable sanitized snapshot script is
[network-audit-baseline.mjs](../../scripts/network-audit-baseline.mjs); output is
`.local/network-audit/reports/baseline.json`. Its nullable-allowlist harness fix
and successful rerun are documented in verification. This is parsed configuration
plus selected audit-process overrides, not fully merged live product state and
not a rerun of the failing full suite. Ignored audit evidence lives under
`.local/network-audit/reports/`; it may be absent in a fresh clone. Keep generated
artifacts on G and never reproduce credential values in handoffs or logs.

Passing characterization tests reproduce defects; they are not a security verdict.
Source and existing dist evidence are separate; no rebuild or whole-program
equivalence is claimed. Runtime PostHog/Sentry and app updates remain disabled,
but that does not establish offline operation or disable build-time uploads.
Focused remediation tests show the targeted safety behaviors, not full release
readiness. Before any push/release/install refresh, run type checking, build,
the relevant focused suites, and decide whether to rerun or triage the prior
full-suite blockers.

The dist-dependent telemetry and provider-loopback tests now live under `audit/`
and run with standalone `audit/vitest.config.ts`, separately for source and
existing dist. Their former `src/` paths are absent. Final explicit noEmit covered
all audit test files; root Vitest/TypeScript configuration remained unchanged.
Default-suite exclusion was checked statically, not by a clean-CI run. See
verification and ignored `final-discovery.json`, `final-test-summary.json`, and
`process-completion.json` in the audit report directory for evidence. Mock and
bounded `127.0.0.1` receipt cases passed without external contacts or dist changes;
broader dist and MCP lifecycle coverage remains limited as documented.

Real TUI startup/idle/turn/shutdown, browser and connector process-tree captures
still require a network-isolated environment. Authenticated receipt/ownership
checks additionally require explicit authorization; credential presence does not
authorize use. Mock interception is not OS network isolation, loopback receipt is
not provider receipt, and the passive snapshot with no product root process does
not prove a running app was quiet. Remote delivery, retention, account ownership,
and historical exfiltration remain unverified. Preserve the specific untested
transports and lifecycle gaps listed in verification.

The earlier readability/theme work remains completed locally for manual review;
its build/install and ConPTY evidence are historical, referenced in the architecture
record. The old PTY interaction blocker is resolved; sidecar live smoke remains
unrun. The prior full-suite failure evidence remains in
`.local/reports/rebrand-stage5-full.log` and `rebrand-stage5-full.json`.

## Resume checklist

1. Read verification and dependencies/build first, then findings, ledger, ownership,
   architecture record, and current diff. Use the final relocated verification
   section; preserve its static-discovery versus clean-CI distinction. Then read
   the current F01-F03 diff before making any assumption from this compact handoff.
2. Verify F01-F03 with fresh local focused runs if continuing implementation.
   Pay special attention to redirect method/body semantics, host allowlist order,
   manual downloader redirects, and redaction boundaries that must not alter
   actual execution inputs.
3. Update [decisions.md](decisions.md), [findings](../network-audit/findings.md),
   [verification](../network-audit/verification.md), and the endpoint ledger with
   the final remediation outcome once broader checks are complete. Reference this
   handoff rather than copying long result logs.
4. Next security areas are network defaults and subprocess credential access,
   including MCP stdio environment policy. Then continue first-party attribution
   and reporting policy using [ownership](../network-audit/ownership.md). Keep
   source-map upload policy separate from runtime reporting. Branding does not
   transfer third-party service ownership.
5. Retain the 14-failure full-suite blocker and existing broader-fix approval
   context. Do not infer baseline reproduction or a passing release gate from
   audit or focused remediation tests. Distribution/core work and new features
   remain deferred.
6. Close live-capture/authenticated-receipt gaps only under their required
   containment and authorization. Update canonical reports and reference them
   here instead of duplicating findings or changing counts.

## Suggested skills

- `understand-anything:understand-diff`: useful for reviewing a later remediation
  diff and affected components; not a substitute for transport tests.
- `understand-anything:understand-explain`: useful for a targeted read of the
  redirect, downloader, sanitizer, or trace paths before changing them further.
- `impeccable`: use only for later approved privacy/status or TUI presentation work.
- Prefer codebase-memory MCP `search_graph`, `trace_path`, and `get_code_snippet`
  for code discovery under AGENTS.md. These are tools, not an additional skill;
  use documented fallbacks if unavailable or insufficient.

This handoff role owns only `docs/rebrand/handoff.md`. It updated this document;
it ran no tests, production code, builds, pushes, or service calls.
