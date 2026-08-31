import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Read-only snapshot: no bootstrap, config migration, subprocess, or network.
const root = fileURLToPath(new URL("../", import.meta.url));
const state = resolve(root, ".local/state");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const hash = (path) => existsSync(resolve(root, path))
  ? createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex")
  : null;
const pkg = JSON.parse(read("package.json"));
const { parseUserConfigFile } = await import("../dist/config/config-schema.js");
let config;
let parsed;
try {
  config = JSON.parse(readFileSync(resolve(state, "config.json"), "utf8"));
  parsed = parseUserConfigFile(config);
} catch {
  process.stderr.write("Audit baseline: config could not be read or validated; details withheld.\n");
  process.exit(1);
}
const { loadDotenvFromStateDir } = await import("../dist/config/load-dotenv.js");
// Reject malformed dotenv entries silently here instead of echoing untrusted keys.
const dotenv = loadDotenvFromStateDir(state, {
  readFile(path) {
    return readFileSync(path, "utf8").split(/\r?\n/)
      .filter((line) => /^[A-Z_][A-Z0-9_]*\s*=/.test(line.trim())).join("\n");
  },
});
const present = (key) => Boolean(process.env[key]);
const boolEnv = (key, fallback) => present(key)
  ? ["1", "true", "yes", "on"].includes(process.env[key].toLowerCase())
  : fallback;
function endpoint(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return {
      origin: url.origin,
      hasUserInfo: Boolean(url.username || url.password),
      hasQuery: Boolean(url.search),
      hasPath: url.pathname !== "/",
    };
  } catch { return { invalid: true }; }
}
const serviceKeys = [
  "OPENAI_API_KEY", "OPENAI_COMPAT_API_KEY", "ATOMIC_AGENT_OPENAI_API_KEY",
  "OPENROUTER_API_KEY", "AIMLAPI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY",
  "ANTHROPIC_API_KEY", "ATOMIC_AGENT_LLAMA_API_KEY", "EXA_API_KEY", "BRAVE_SEARCH_API_KEY",
  "TELEGRAM_BOT_TOKEN", "GITHUB_TOKEN", "GH_TOKEN", "HF_TOKEN", "HUGGING_FACE_HUB_TOKEN",
  "CLAWHUB_TOKEN", "SENTRY_AUTH_TOKEN",
];
const proxyKeys = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY",
  "http_proxy", "https_proxy", "all_proxy", "no_proxy", "NODE_USE_ENV_PROXY"];
const entries = parsed.llm?.providers ?? [];
const output = {
  capturedAt: new Date().toISOString(),
  scope: "G-drive launcher state + audit process environment; not running-process memory",
  runtime: process.version,
  package: { name: pkg.name, version: pkg.version, bin: pkg.bin },
  rawConfigVersion: config.version,
  parsedConfigAndSelectedOverrides: {
    analyticsFlag: parsed.analytics.enabled,
    localMode: parsed.localModels.mode,
    localEndpoint: endpoint(parsed.localModels.mode === "managed"
      ? `http://127.0.0.1:${parsed.localModels.managed.port}` : parsed.localModels.url),
    backendAutoUpdate: parsed.localModels.managed.autoUpdate,
    llmSelection: parsed.llm ? "explicit providers" : "legacy local-llama fallback",
    providers: entries.map((entry, index) => ({ index, kind: entry.kind,
      endpoint: endpoint(entry.baseUrl), inlineCredentialPresent: Boolean(entry.apiKey),
      customHeaderCount: Object.keys(entry.headers ?? {}).length,
    })),
    activeTextProviderConfigured: Boolean(parsed.llm?.activeTextProvider),
    activeEmbeddingProviderConfigured: Boolean(parsed.llm?.activeEmbeddingProvider),
    legacyEmbeddingsEnabled: parsed.memory.embeddings.enabled,
    visionEnabled: parsed.vision.enabled,
    webSearchEnabled: parsed.web.search.enabled,
    webSearchProvider: parsed.web.search.provider,
    webSearchFallback: parsed.web.search.fallback,
    exaEndpoint: endpoint(parsed.web.search.exa.endpoint),
    exaApiEndpoint: endpoint(parsed.web.search.exa.apiEndpoint),
    webFetch: "registered tool; no standalone enabled flag",
    httpEnabled: parsed.http.enabled,
    httpApprovalMode: parsed.http.approvalMode,
    httpAllowlistCount: parsed.http.hostAllowlist?.length ?? null,
    httpAllowlistMode: parsed.http.hostAllowlist === null ? "unrestricted" : "restricted",
    browserEnabled: boolEnv("ATOMIC_AGENT_BROWSER_ENABLED", true),
    browserCdpConfigured: present("ATOMIC_AGENT_BROWSER_CDP_URL"),
    reactDevtoolsEnabled: process.env.DEV === "true",
    telegramEnabled: parsed.telegram.enabled,
    telegramOwnerConfigured: parsed.telegram.ownerUserId !== null,
    mcpServers: parsed.mcp.servers.map((server, index) => ({ index,
      enabled: server.enabled, transport: server.transport.kind,
      endpoint: endpoint(server.transport.url),
      environmentOverrideCount: Object.keys(server.env ?? {}).length,
      customHeaderCount: Object.keys(server.transport.headers ?? {}).length,
    })),
    tracingEnabled: parsed.tracing.trace.enabled,
    inboundWebhookCount: Object.keys(parsed.webhooks).length,
  },
  dotenv: { exists: dotenv.exists, appliedNames: dotenv.loaded, skippedNames: dotenv.skipped },
  environment: {
    credentials: Object.fromEntries(serviceKeys.map((key) => [key, present(key)])),
    proxyVariables: Object.fromEntries(proxyKeys.map((key) => [key, present(key)])),
    productOverrideNames: Object.keys(process.env).filter((key) => key.startsWith("ATOMIC_AGENT_")).sort(),
  },
  sha256: Object.fromEntries([
    "package.json", "package-lock.json", ".local/bin/h0x-cli.cmd", "dist/cli/index.js",
    "src/analytics/posthog-config.ts", "dist/analytics/posthog-config.js",
    "src/error-reporting/sentry-config.ts", "dist/error-reporting/sentry-config.js",
    "src/mcp/mcp-client.ts", "dist/mcp/mcp-client.js",
    "src/tools/os/http-request-fetch.ts", "dist/tools/os/http-request-fetch.js",
    "src/llm/provider/openrouter/openrouter-provider.ts", "dist/llm/provider/openrouter/openrouter-provider.js",
  ].map((path) => [path, hash(path)])),
};
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
