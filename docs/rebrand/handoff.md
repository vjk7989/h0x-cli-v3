---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up.
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
---

# Deep Network Audit Handoff

## Next-session focus

Prioritize credential leaks, then network policy, first-party branding, and the
reporting decision. Identity target remains **h0x-cli by PAVii.Ai**, website
**pavii.tech**. The user deferred reporting policy until reviewing this audit;
no removal, activation, or migration decision has been made.

Finalized on 2026-08-31 after the parent's final evidence signal. All five audit
reports exist. Audit completion is limited to the documented static and synthetic
evidence; real runtime capture and authenticated remote probes remain blocked.
Final relocated verification, including bounded native loopback receipt, passed;
no loopback test remains pending. Production and explicit audit-file noEmit checks
passed, and all recorded runner processes completed successfully without timeout.
Consult [final verification](../network-audit/verification.md#final-relocated-verification)
for authoritative results and distinct counts; historical runs and relocation
reruns must not be added together.

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
  deep audit entry and completed readability/theme follow-up.
- [Product register](../../PRODUCT.md) and [AGENTS.md](../../AGENTS.md): approved
  identity, compatibility boundaries, G-drive storage rules, and engineering gates.
- [Failure plan](failure-plan.md): prior 14 full-suite failures across 10 files;
  these remain push/release blockers, not cleared by focused audit passes.

## Evidence and constraints

Current scope is audit, tests, and documentation only. No production fixes,
connector or identity changes, real service calls, account/token changes,
installation, build, push, or release occurred in this audit. Preserve existing
worktree changes; inspect the actual diff before any later implementation.

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
   section; preserve its static-discovery versus clean-CI distinction.
2. Check the user's latest authorization before implementing fixes; the audit
   itself grants none. Prioritize findings F01-F03: redirects, download token
   routing, and diagnostic/persistence exposure. Include eval key-routing risks
   from the dependency report when scoping credential work.
3. After credential work is authorized and verified, decide network defaults and
   subprocess credential access, then first-party attribution and reporting policy
   using the ownership checklist. Keep source-map upload policy separate from
   runtime reporting. Branding does not transfer third-party service ownership.
4. Retain the 14-failure full-suite blocker and existing broader-fix approval
   context. Do not infer baseline reproduction or a passing release gate from
   audit tests. Distribution/core work and new features remain deferred.
5. Close live-capture/authenticated-receipt gaps only under their required
   containment and authorization. Update canonical reports and reference them
   here instead of duplicating findings or changing counts.

## Suggested skills

- `understand-anything:understand-diff`: useful for reviewing a later remediation
  diff and affected components; not a substitute for transport tests.
- `impeccable`: use only for later approved privacy/status or TUI presentation work.
- Prefer codebase-memory MCP `search_graph`, `trace_path`, and `get_code_snippet`
  for code discovery under AGENTS.md. These are tools, not an additional skill;
  use documented fallbacks if unavailable or insufficient.

This handoff role owns only `docs/rebrand/handoff.md`. It read the reports and
updated this document; it ran no tests, production code, builds, or service calls.
