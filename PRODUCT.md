# h0x - CLI

Product register, 2026-08-31. Detailed decisions and verification evidence are maintained in the architecture record linked below.

| Field | Approved identity |
| --- | --- |
| Product | h0x - CLI |
| Command, package, and terminal banner | `h0x-cli` |
| Company | PAVii.Ai |
| Attribution | Built by TEAM PAVii.Ai |
| Website | https://pavii.tech |
| Documentation | https://pavii.tech/docs (temporary placeholder, not verified live) |
| Destination repository | https://github.com/vjk7989/h0x-cli-v3 |

## Product and Audience

A local-first AI operator for people working in a terminal, using local or cloud models. The inherited runtime can browse, read and edit files, run approved shell commands, inspect documents, remember context across sessions, schedule tasks, and call MCP tools. HTTP and a Tauri sidecar support embedding. These describe the existing codebase from [README.md](README.md), not newly delivered h0x features or verified performance claims.

## Current Objective

Rebrand from the visible surface toward distribution and core identity, then launch as the team's product. Add original features only after the rebrand; no new feature set is committed here.

The first stage retains the full-screen Ink TUI in the invoking terminal and directory. Its empty-chat welcome uses original dotted `h0x-cli` artwork, version, actual model and directory, available Git repository/branch context, team attribution, website, and the explicitly temporary docs link. Preserve navigation, model setup, permissions, and agent behavior.

The approved visual follow-up is complete locally: clearer lowercase branding and theme-consistent purple chrome are implemented, tested, built, and installed. See [the follow-up decision](docs/rebrand/decisions.md#approved-visual-follow-up) for artwork, accent-preview behavior, and verification evidence. Only the user's manual check and prior full-suite push blockers remain open; no full-suite rerun or push was performed.

## Boundaries and Sources

Keep existing command aliases, config/environment names, storage compatibility, APIs, and version during this stage. Preserve the MIT license and upstream copyright; product branding does not replace provenance. Do not publish packages or releases yet.

The approved decisions, implementation entry points, pending stages, and verification expectations live in [the architecture record](docs/rebrand/decisions.md). Contributor policy remains in [AGENTS.md](AGENTS.md); upstream license text remains in [LICENSE](LICENSE).
