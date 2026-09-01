# Connector ownership and rebranding requirements

Decision state: inventory and requirements only, 2026-08-31. No connector account,
credential, endpoint, billing, bot, OAuth registration or production identity was
changed. User will decide reporting policy after reviewing the audit.

## Identity contract

- Machine identifier: `h0x-cli`.
- Customizable app display name: `h0x-cli by PAVii.Ai`.
- Company: `PAVii.Ai`; website: `https://pavii.tech`.
- Repository: `https://github.com/vjk7989/h0x-cli-v3`.
- These are first-party identities, not replacements for names such as OpenRouter,
  Telegram, Google, Claude, or the owner of a third-party MCP server.
- A label/header change does not transfer an account, collected reports, billing,
  authentication permissions, service hosting, or intellectual-property rights.

## Prioritized implementation checklist for a later approved task

1. Fix credential routing and diagnostic exposure identified in [findings](findings.md).
   Replace characterization assertions with security assertions while retaining
   evidence of the original behavior; cover source and shipped artifacts.
2. Decide network policy: background catalog/backend checks versus explicit actions;
   permitted HTTP hosts and approval defaults; trusted subprocess credential access.
   Do not claim offline operation merely because telemetry is disabled.
3. Rebrand first-party attribution in a separately tested patch: OpenRouter inference,
   key verification, embeddings, MCP client handshake/version, AI/ML source header,
   GitHub/Hugging Face/ClawHub download User-Agents. Preserve custom user settings.
   Source implementation is in progress on 2026-09-01; see
   [the rebrand ADR](../rebrand/decisions.md#connector-ownership-rebrand).
4. PostHog policy selected on 2026-09-01: use the PAVii-owned EU Cloud project,
   enabled by default with opt-out through `analytics.enabled: false`. Sentry
   runtime reporting remains disabled until a DSN, retention policy and error
   reporting policy are provided. Source-map uploads are a separate build decision.
5. Configure only user-owned services, then obtain approval for synthetic authenticated
   checks. Verify account/dashboard ownership separately from local request formatting.
6. Keep existing full-suite failures as release/push blockers. No automatic package
   publication, remote migration, bot creation, release signing or deployment.

## Requirements by service

| Area | What can change in code | What you must own/provide | Verification before activation |
| --- | --- | --- | --- |
| OpenRouter | App URL and title in all request builders; prefer documented `X-OpenRouter-Title` alongside `HTTP-Referer` | Chosen app identity/website, appropriate provider account/key and billing for an approved live check | Local request assertions first; service app attribution later. Attribution can surface usage in provider rankings/analytics, so this is not tracking removal. |
| AI/ML API | First-party source identifier `agent/h0x-cli`, if accepted by provider contract; no invented partner/referral ID | Your account/key for your own requests, or end-user key design | Confirm accepted header semantics with official provider documentation before patch; capture local headers without paid calls. |
| MCP client | Our `initialize.clientInfo.name` and truthful installed version | No new account for a local client label. Each actual server may need its own endpoint, account and least-privilege credentials | Local HTTP/SSE/stdio handshake and reconnect tests. Do not rename server/tool namespaces or bypass server authentication. |
| GitHub/Hugging Face/ClawHub clients | User-Agent product token | Usually no account just for a UA change. Private/gated access still needs the correct provider account/token and applicable model access | Parsed-origin credential tests, redirected-download handling, no foreign-host token forwarding. |
| PostHog | Source now points to the PAVii EU Cloud ingestion host and public project token; the existing privacy toggle remains the opt-out | Organization/project ownership, public project token, dashboard access, event list, retention, deletion/access policy and approved consent design. Rotate any pasted personal PostHog API key and never ship it | Test opt-out, no queued send after opt-out, no-content collection, shutdown and failures; check live receipt only with explicit authorization. |
| Sentry runtime, only if chosen | Your DSN and release identity; tighten scrubber contract | Organization/project ownership, DSN/region, access controls, retention, reporting policy | Review dynamic error names/functions/hostnames as potentially identifying data; test source and packaged error payloads before enabling. |
| Sentry source maps, only if chosen | Your org/project/release and CI upload configuration | Separately stored scoped CI auth token; decision to upload proprietary source; repository integration only if intended | Verify artifact contents locally. A DSN is not a CI auth token. Never ship CI tokens in distributable files. |
| Telegram | First-party welcome/help copy; display actual bot identity returned by service | A bot controlled by you, chosen display name and available username, bot token, intended owner/chat permissions | Local getMe/send/polling tests first; approved test-chat pairing later. Renaming our TUI cannot rename another person's bot. |
| OAuth integrations, if later added/discovered in external clients | Only our own app registration metadata and supported client flow | Provider app registration, allowed redirects/scopes, domain control and any required verification/review | Per-provider public-client flow; no embedded confidential client secret. Existing subscription CLI logins remain those clients' identities. |
| Cloud models/search/embeddings | UI labels and compatible endpoint settings, not provider ownership | Decide user-supplied keys versus company-funded access; appropriate accounts, budget limits and data policy | Functional compatibility and synthetic local fixtures. Company-funded public distribution needs a secure server-side credential design, not a shared secret embedded in the CLI. |
| Managed backend/releases | Update repository/artifact references only after replacement exists | Build/release infrastructure, maintained binaries/checksums, repository permissions, signing identity if used, distribution/update policy | Reproducible builds and artifact integrity before restoring updates; cannot substitute `pavii.tech` for a GitHub API without a compatible service. |
| Subscription CLIs/browser/external skills | Our wrapper labels and explicit execution policy | User-owned external login/session and trust in installed program/skill | Independent audit of those programs and subprocess traffic. No claim of PAVii ownership of Claude/Codex/browser services. |
| Google Workspace through the bundled gog skill | Our skill copy; the external CLI's OAuth app identity is separate | An OAuth client configuration you control if you want your own consent-screen identity, permitted Workspace scopes, intended user accounts and secure local credential storage | Review the external gog binary and provider registration requirements first. Even its auth diagnostic may refresh a token; do not run it as an offline check. |
| Notion through the bundled skill | Our skill copy, not the service-side integration identity | A Notion integration controlled by you, its branding/capabilities, token and explicitly granted workspace/page access | Verify local request formatting before authorized service tests; never substitute an upstream/shared token. |
| GitHub through gh/skills | Our wrapper label; service account, GitHub App or OAuth identity requires separate ownership | Your account or appropriately registered app, repository permissions and scoped credentials | gh's existing login is not transferred by rebranding the wrapper. Audit its selected host/account before use. |

## Information needed from the owner after the audit

- Reporting choice: remain disabled, remove, or opt-in PAVii-owned reporting.
- Allowed automatic connections and whether first launch must be offline-capable.
- Which connectors the product will officially support; which remain user-configured.
- Account/project identifiers and preferred regions for retained reporting services;
  credentials must be entered via secure local/CI secret storage, never chat or Git.
- Data categories, consent, retention/deletion and access policy before collecting
  customer reports; obtain appropriate privacy review for the intended launch.
- Whether provider usage attribution is desired, independent of our own analytics.

No new account is needed for first-party label changes alone. A third-party SaaS
account is sufficient for many integrations; owning a custom server is needed only
when replacing/hosting the service or protecting company-funded secret credentials.

## Official references

- [OpenRouter attribution](https://openrouter.ai/docs/app-attribution): app URL is the
  attribution identifier; `X-OpenRouter-Title` sets the name, with `X-Title` retained
  for backwards compatibility. Website/title attribution is not account migration.
- [PostHog Node configuration](https://posthog.com/docs/libraries/node): client key
  and ingestion host configuration. Do not confuse an ingestion key with a private
  administrative account token.
- [Sentry token permissions](https://docs.sentry.io/api/permissions/): CI/source-map
  upload permissions are separate from runtime event ingestion.
- [Telegram bot management](https://core.telegram.org/bots/features): BotFather
  controls bot registration/name/username and issues the authentication token.

References were consulted during planning; verify provider requirements again at
the time of actual account setup. No provider dashboard or authenticated API was
accessed during this audit.
