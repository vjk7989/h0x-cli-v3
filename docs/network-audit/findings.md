# h0x-cli deep network audit

Date: 2026-08-31. Scope: first-party source, installed distribution, connector
configuration, dependencies/build/skills, and controlled synthetic tests.
This is an audit, not remediation or a certification of zero external traffic.
Production code, connector settings, credentials, installed build and remote accounts
remain unchanged. Only audit scripts, tests and documentation are added.

## Executive finding

Runtime PostHog/Sentry ingestion and application self-update remain disabled.
Nevertheless, the product is not offline: startup catalogs, optional model/search/
browser services, backend checks and external subprocesses can contact other hosts.
The scan also identified credential-handling defects that matter more than changing
an app label. No historical exfiltration or remote report delivery was established.

Read [endpoint ledger](endpoint-ledger.md), [verification matrix](verification.md),
[dependency/build scan](dependencies-and-build.md), and
[ownership requirements](ownership.md) for the evidence and next steps.

Verification completed: 146 distinct focused tests passed (28 new audit cases and
118 existing checks), with separate source/existing-build processes and production
plus explicit audit-file type checks. Local HTTP receivers acknowledged synthetic
provider requests; no external provider was contacted. Passing characterization
tests reproduce open defects and must not be treated as security approval.
Build-dependent checks live in the opt-in `audit/vitest.config.ts` suite so default
source-test discovery does not require a prebuilt distribution. See the verification
matrix for exact commands, evidence and untested lifecycle boundaries.

## Baseline and configuration

- Git HEAD: `4caff55e6afb9d9a61b36e9fa98bf9afd7531582` (upstream v0.4.2);
  branch `codex/rebrand-surface`. Existing rebrand changes are uncommitted and preserved.
- Package `h0x-cli` 0.4.2; pinned Node v25.7.0. Launcher `.local/bin/h0x-cli.cmd`
  invokes this checkout's `dist/cli/index.js`, preserves cwd/streams, and redirects
  state/temp/cache/browser paths to G. No build or reinstall during this audit.
- Sanitized repeatable snapshot: `scripts/network-audit-baseline.mjs`; output
  `.local/network-audit/reports/baseline.json` includes hashes of package/lock,
  launcher, entrypoint and security-relevant source/dist modules. Hashes identify
  artifacts, not proof of semantic source/build equivalence.
- Config schema 45: legacy local-llama selection at `http://127.0.0.1:8080`, no
  explicit cloud or embedding providers, legacy embeddings disabled, no MCP servers,
  Telegram disabled, no inbound webhook bindings. Vision/browser enabled.
- Search enabled: Exa with DuckDuckGo fallback. Raw HTTP enabled with approval mode
  `never` and no hostname allowlist. Null allowlist does not disable the SSRF guard.
- Analytics saved flag true, but sentinels prevent client creation. Managed backend
  auto-update flag true; backend-check and app-update paths are separate.
- No state `.env` found. Audit-process environment contains OpenAI/OpenRouter/Telegram
  credential variables; values were neither printed nor used. GitHub/Hugging Face/
  Exa/Sentry build-token variables and proxy overrides were absent in this snapshot.
  Audit-process environment is not a capture of another terminal's live environment.
- Configuration was parsed read-only, with selected relevant environment overrides;
  the real runtime was not bootstrapped against user state. No key validity/ownership
  inference is made from variable presence.
- Passive process-tree snapshot at 19:31:07 +05:30 found no matching product CLI root.
  Consequently its zero TCP/UDP count is **not** evidence of a quiet running app.
- Prior full-suite run: 6509 passed, 14 failed, 4 skipped; 10 failing files. Not rerun
  or cleared here. [Existing failure analysis](../rebrand/failure-plan.md) remains the
  source of truth and a push/release blocker.

## Findings by priority

### F01 High: cross-origin HTTP/search redirects forward credentials

`src/tools/os/http-request-fetch.ts:290` rebuilds every hop with the original
`args.headers`. Raw HTTP forwards Authorization, Cookie and API-key headers even
when a redirect changes origin; 307 preserves the body. The configured hostname
allowlist is checked only on the initial URL in `src/tools/os/http-request.ts:70`.
Redirect SSRF checks reject internal addresses, not other public hosts outside that
allowlist. Search transport also reuses original headers AND body for 302/303/307/308
(`src/tools/os/web-search/transport/search-http.ts:134`). Exa/Brave keys can enter
that transport through their provider headers.

Evidence: nine isolated mock tests in `src/tools/os/http-redirect.network-audit.test.ts`
passed, reproducing the behavior. No real origin, DNS lookup or curl process ran.
An authorized/configured initial server or intermediary must issue the redirect;
the tests do not show an actual provider exploiting it.

Required fix: validate destination policy on every hop; reject cross-origin
credential-bearing redirects by default or use an explicitly approved policy;
rebuild allowed headers per origin and apply correct method/body semantics.
Test host changes, port/scheme changes, downgrade, retries, and allowlist boundaries.

### F02 High: download token selection uses URL substrings, not host ownership

`src/local-llm/download-file.ts:42` attaches GitHub credentials when the complete URL
contains `github.com`/`githubusercontent.com`, and Hugging Face credentials when it
contains `huggingface.co`. A query/path/lookalike containing those strings can select
a credential even when the actual hostname is unrelated. Callers include backend
release asset URLs and model download URLs (`backend-installer.ts:285`,
`model-installer.ts:52`). A controlled download URL plus a present credential is
required; current observed environment has neither GitHub nor Hugging Face tokens.

Evidence: synthetic tests use an unrelated `.invalid` host with a matching query
string, intercept fetch before any network, and stop before filesystem writes.
All three cases passed. This is a token-routing defect, not evidence
that historical downloads leaked credentials or that upstream assets are malicious.

Required fix: parse URL and allow credentials only for explicitly trusted HTTPS
origins, with a deliberate redirect policy; test query/userinfo/lookalikes,
subdomains, non-HTTPS URLs and credential aliases. Do not fix with another substring.

### F03 High: credential text survives tool diagnostics and MCP error handling

HTTP success and failure results expose complete curl header arguments in
`details.command` (`src/tools/os/http-request.ts:139`, `:164`). The compressor
preserves details; step execution retains latest-result details and trace events
copy them (`src/agent/step-executor.ts:920`, `src/tracing/trace/trace-recorder.ts:197`).
Approval previews also include supplied headers (`http-request.ts:326`).
The MCP helper named `scrubErrorMessage` only trims/truncates text; it is not secret
redaction (`src/mcp/mcp-errors.ts:59`). Synthetic server exceptions and `isError`
responses can retain Bearer credential text.

Evidence: mocked HTTP success/failure assertions reproduce exposure; MCP SDK tests
exercise error paths without executing a server process. No real credential used.
The normal prompt renderer uses tool summaries, not the entire `details` object;
do not claim `details.command` is automatically sent to a cloud model. Original tool
arguments ARE serialized into conversation prompts (`src/session/conversation-turn.ts:155`),
and error text may enter summaries. Downstream transmission depends on that flow.

Required fix: avoid retaining credential argv; redact sensitive headers, URL
userinfo/query credentials and error reflections before persistence/display.
Handle original tool args separately. Add assertions at result, trace and prompt
boundaries, not just a helper named scrub.

### F04 Medium: third-party subprocesses receive the full environment

MCP stdio copies all `process.env` plus configured overrides
(`src/mcp/mcp-client.ts:417`). The generic runner and subscription CLI similarly
inherit env (`src/sandbox/command-runner.ts:74`,
`src/llm/provider/subscription-cli/stream-cli-completion.ts:28`). A configured connector
can therefore access credentials for unrelated services. MCP initialize does not
automatically serialize those env values; synthetic tests distinguish these facts.

Required follow-up: define a least-privilege per-process environment policy and
compatibility tests. Until then, execute only trusted connectors/scripts. No
uncontained MCP/browser/subscription CLI was run to observe possible child egress.

### F05 Medium: background requests and permissive functional network defaults

TUI mount invokes cloud-catalog prefetch for OpenRouter and AI/ML API even with no
cloud provider configured. Local-model refresh checks an upstream GitHub release
repository. These send request metadata; they do not upload chat bodies by themselves.
Search sends user/agent queries to its configured provider/fallback. HTTP has no
hostname restriction and no per-request approval by default in the observed config.

Required follow-up: decide which automatic connections are acceptable, explicitly
document query/model/image traffic, and make checks user-triggered or configurable
where policy requires. Do not confuse a local model selection with global offline mode.

### F06 Conditional high impact: upstream Sentry release upload remains available

The standalone bundler configures Sentry org `atomic-agent`, project `cli`, and
conditionally enables the plugin with `SENTRY_AUTH_TOKEN`. This is independent of
the runtime placeholder DSN. Source maps can contain source code; plugin
`telemetry: false` does not disable explicitly configured source-map uploads.

See [dependency/build evidence](dependencies-and-build.md) for upload, release/commit
association, dependency hooks and signing details. No token was present in the audit
process; ordinary TypeScript build is not this bundling path. No build/upload ran.
Before any release bundling, remove upstream upload configuration or deliberately
configure an owned project and narrowly scoped CI token after the reporting decision.

### F07 Low: upstream identities and misleading reporting status remain

OpenRouter still receives old app attribution on configured model/verification/
embedding requests; AI/ML source header and several download User-Agents also use
upstream names. MCP advertises `atomic-agent` version `0.1.0`, not the installed
product version. These are attribution/compatibility issues, not proof of an author
receiving private chat messages. See [ownership checklist](ownership.md).

The privacy UI can display analytics as on using its saved flag while factories are
disabled. A local random install ID is created independently of reporting. Improve
truthful status before public launch. If reporting is ever re-enabled, review retained
dynamic error names/functions/hostnames and model identifiers; existing comments
claiming anonymity are not proof that all fields are non-identifying.

## Scope limits and completion criteria

The endpoint map and synthetic checks are reproducible audit evidence, not a whole-
machine packet capture. No real service receipt/account ownership, past transmissions,
remote retention, production CI secrets, arbitrary third-party plugin behavior, or
future dynamically generated destination was verified. Dependencies contain native
and third-party code that requires separate containment/runtime analysis.

Real full-TUI first launch/idle/turn/shutdown, browser traffic and real connector
process-tree captures remain blocked on a network-isolated environment and, for
authenticated checks, explicit authorization. Mock lifecycle coverage is recorded
separately in verification. Existing key presence does not authorize using it.

No production remediation, reporting-policy decision, release/push, account creation,
or installation was performed. The next task should address high-priority credential
findings before identity-only changes or any decision to collect customer reports.
