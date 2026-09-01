import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadConfig } from "./load-config.js";
import { resetConfigCache } from "./config-cache.js";
import { getUserConfigPath, writeUserConfigFileSync } from "./config-file.js";
import { USER_CONFIG_DEFAULTS, USER_CONFIG_VERSION } from "./config-schema.js";

describe("loadConfig", () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), "atomic-load-"));
    process.env.ATOMIC_AGENT_STATE_DIR = stateDir;
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    resetConfigCache();
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
    delete process.env.ATOMIC_AGENT_STATE_DIR;
    delete process.env.H0X_CLI_STATE_DIR;
    delete process.env.ATOMIC_AGENT_LLAMA_API_KEY;
    delete process.env.H0X_CLI_LLAMA_API_KEY;
    delete process.env.ATOMIC_AGENT_LLAMA_MAX_TOKENS;
    delete process.env.H0X_CLI_LLAMA_MAX_TOKENS;
    delete process.env.ATOMIC_AGENT_BROWSER_CHANNEL;
    delete process.env.H0X_CLI_BROWSER_CHANNEL;
    delete process.env.ATOMIC_AGENT_GRAMMARS_DIR;
    delete process.env.H0X_CLI_GRAMMARS_DIR;
    delete process.env.ATOMIC_AGENT_REPO;
    delete process.env.H0X_CLI_REPO;
    delete process.env.ATOMIC_AGENT_TASKS_ENABLED;
    delete process.env.H0X_CLI_TASKS_ENABLED;
    delete process.env.ATOMIC_AGENT_BROWSER_CDP_URL;
    delete process.env.H0X_CLI_BROWSER_CDP_URL;
    delete process.env.ATOMIC_AGENT_STABLE_PREFIX_SALT;
    delete process.env.H0X_CLI_STABLE_PREFIX_SALT;
    delete process.env.ATOMIC_LOADCONFIG_TEST_KEY;
    resetConfigCache();
    vi.restoreAllMocks();
  });

  it("creates a defaults-only config on first run", () => {
    const config = loadConfig();
    const path = getUserConfigPath(stateDir);
    expect(existsSync(path)).toBe(true);
    const written = JSON.parse(readFileSync(path, "utf8"));
    expect(written.version).toBe(USER_CONFIG_VERSION);
    expect(config.localModels.url).toBe("http://127.0.0.1:8080");
    expect(config.localModels.completionMaxTokens).toBe(8192);
    expect(config.log.level).toBe("info");
    expect(config.agent.approvalLevel).toBe(1);
  });

  it("maps ATOMIC_AGENT_LLAMA_MAX_TOKENS to completionMaxTokens with bounds", () => {
    process.env.ATOMIC_AGENT_LLAMA_MAX_TOKENS = "8192";
    resetConfigCache();
    expect(loadConfig().localModels.completionMaxTokens).toBe(8192);
    process.env.ATOMIC_AGENT_LLAMA_MAX_TOKENS = "10";
    resetConfigCache();
    expect(loadConfig().localModels.completionMaxTokens).toBe(64);
    process.env.ATOMIC_AGENT_LLAMA_MAX_TOKENS = "999999999";
    resetConfigCache();
    expect(loadConfig().localModels.completionMaxTokens).toBe(131_072);
  });

  it("reads localModels.completionMaxTokens from the user config file", () => {
    writeUserConfigFileSync(getUserConfigPath(stateDir), {
      ...USER_CONFIG_DEFAULTS,
      localModels: {
        ...USER_CONFIG_DEFAULTS.localModels,
        completionMaxTokens: 8192,
      },
    });
    resetConfigCache();
    expect(loadConfig().localModels.completionMaxTokens).toBe(8192);
  });

  it("ATOMIC_AGENT_LLAMA_MAX_TOKENS overrides the file value", () => {
    writeUserConfigFileSync(getUserConfigPath(stateDir), {
      ...USER_CONFIG_DEFAULTS,
      localModels: {
        ...USER_CONFIG_DEFAULTS.localModels,
        completionMaxTokens: 8192,
      },
    });
    process.env.ATOMIC_AGENT_LLAMA_MAX_TOKENS = "16384";
    resetConfigCache();
    expect(loadConfig().localModels.completionMaxTokens).toBe(16_384);
  });

  it("lets H0X_CLI_LLAMA_MAX_TOKENS override the legacy env var", () => {
    process.env.ATOMIC_AGENT_LLAMA_MAX_TOKENS = "8192";
    process.env.H0X_CLI_LLAMA_MAX_TOKENS = "32768";
    resetConfigCache();
    expect(loadConfig().localModels.completionMaxTokens).toBe(32_768);
  });

  it("reads values from an existing user config file", () => {
    writeUserConfigFileSync(getUserConfigPath(stateDir), {
      ...USER_CONFIG_DEFAULTS,
      localModels: {
        ...USER_CONFIG_DEFAULTS.localModels,
        url: "http://llama.internal:4444",
      },
      log: { level: "debug" },
      agent: {
        ...USER_CONFIG_DEFAULTS.agent,
        tokenBudget: 3000,
        maxSteps: 42,
        toolTimeoutMs: 12_000,
        approvalLevel: 5,
      },
    });
    const config = loadConfig();
    expect(config.localModels.url).toBe("http://llama.internal:4444");
    expect(config.log.level).toBe("debug");
    expect(config.agent.maxSteps).toBe(42);
    expect(config.agent.toolTimeoutMs).toBe(12_000);
    expect(config.agent.approvalLevel).toBe(5);
  });

  it("keeps non-user-facing knobs on environment variables", () => {
    process.env.ATOMIC_AGENT_LLAMA_API_KEY = "secret";
    process.env.ATOMIC_AGENT_BROWSER_CHANNEL = "msedge";
    const config = loadConfig();
    expect(config.localModels.apiKey).toBe("secret");
    expect(config.browser.channel).toBe("msedge");
  });

  it("lets H0X_CLI env vars override legacy equivalents for non-user-facing knobs", () => {
    process.env.ATOMIC_AGENT_LLAMA_API_KEY = "legacy-secret";
    process.env.H0X_CLI_LLAMA_API_KEY = "h0x-secret";
    process.env.ATOMIC_AGENT_BROWSER_CHANNEL = "chrome";
    process.env.H0X_CLI_BROWSER_CHANNEL = "msedge";
    resetConfigCache();

    const config = loadConfig();

    expect(config.localModels.apiKey).toBe("h0x-secret");
    expect(config.browser.channel).toBe("msedge");
  });

  it("keeps legacy ATOMIC_AGENT env vars working when H0X_CLI values are absent", () => {
    process.env.ATOMIC_AGENT_LLAMA_API_KEY = "legacy-secret";
    process.env.ATOMIC_AGENT_BROWSER_CHANNEL = "chromium";
    resetConfigCache();

    const config = loadConfig();

    expect(config.localModels.apiKey).toBe("legacy-secret");
    expect(config.browser.channel).toBe("chromium");
  });

  it("paths point at the state dir and config file", () => {
    const config = loadConfig();
    expect(config.paths.stateDir).toBe(stateDir);
    expect(config.paths.userConfigFile).toBe(getUserConfigPath(stateDir));
    expect(config.paths.browserProfileDir).toBe(
      join(stateDir, "browser-profile"),
    );
    expect(config.paths.tracesDir).toBe(join(stateDir, "traces"));
  });

  it("uses H0X_CLI_STATE_DIR before ATOMIC_AGENT_STATE_DIR", () => {
    const h0xStateDir = mkdtempSync(join(tmpdir(), "h0x-load-"));
    try {
      process.env.ATOMIC_AGENT_STATE_DIR = stateDir;
      process.env.H0X_CLI_STATE_DIR = h0xStateDir;
      resetConfigCache();

      const config = loadConfig();

      expect(config.paths.stateDir).toBe(h0xStateDir);
      expect(config.paths.userConfigFile).toBe(getUserConfigPath(h0xStateDir));
      expect(existsSync(getUserConfigPath(h0xStateDir))).toBe(true);
      expect(existsSync(getUserConfigPath(stateDir))).toBe(false);
    } finally {
      rmSync(h0xStateDir, { recursive: true, force: true });
    }
  });

  it("reads legacy state data without overwriting an existing h0x state dir", () => {
    const h0xStateDir = mkdtempSync(join(tmpdir(), "h0x-load-"));
    try {
      writeUserConfigFileSync(getUserConfigPath(stateDir), {
        ...USER_CONFIG_DEFAULTS,
        log: { level: "debug" },
      });
      writeUserConfigFileSync(getUserConfigPath(h0xStateDir), {
        ...USER_CONFIG_DEFAULTS,
        log: { level: "warn" },
      });
      process.env.ATOMIC_AGENT_STATE_DIR = stateDir;
      process.env.H0X_CLI_STATE_DIR = h0xStateDir;
      resetConfigCache();

      const config = loadConfig();

      expect(config.paths.stateDir).toBe(h0xStateDir);
      expect(config.log.level).toBe("warn");
      const legacyOnDisk = JSON.parse(
        readFileSync(getUserConfigPath(stateDir), "utf8"),
      );
      expect(legacyOnDisk.log.level).toBe("debug");
    } finally {
      rmSync(h0xStateDir, { recursive: true, force: true });
    }
  });

  it("tracing.trace defaults expose the per-session NDJSON dir", () => {
    const config = loadConfig();
    expect(config.tracing.trace.enabled).toBeNull();
    expect(config.tracing.trace.dir).toBe(join(stateDir, "traces"));
    expect(config.tracing.trace.maxBytesPerSession).toBe(10 * 1024 * 1024);
  });

  it("honours user-pinned tracing.trace.enabled", () => {
    writeUserConfigFileSync(getUserConfigPath(stateDir), {
      ...USER_CONFIG_DEFAULTS,
      tracing: { trace: { enabled: false, maxBytesPerSession: 4096 } },
    });
    const config = loadConfig();
    expect(config.tracing.trace.enabled).toBe(false);
    expect(config.tracing.trace.maxBytesPerSession).toBe(4096);
  });

  it("overrides localModels.url to localhost when mode is managed", () => {
    writeUserConfigFileSync(getUserConfigPath(stateDir), {
      ...USER_CONFIG_DEFAULTS,
      localModels: {
        ...USER_CONFIG_DEFAULTS.localModels,
        url: "http://127.0.0.1:8080",
        mode: "managed",
        managed: {
          ...USER_CONFIG_DEFAULTS.localModels.managed,
          port: 19_000,
        },
      },
    });
    resetConfigCache();
    const config = loadConfig();
    expect(config.localModels.mode).toBe("managed");
    expect(config.localModels.url).toBe("http://127.0.0.1:19000");
    expect(config.paths.localModelsDataDir).toBe(join(stateDir, "models"));
  });

  it("carries the .env load outcome as config.dotenv", () => {
    delete process.env.ATOMIC_LOADCONFIG_TEST_KEY;
    writeFileSync(
      join(stateDir, ".env"),
      "ATOMIC_LOADCONFIG_TEST_KEY=from-file\n",
      "utf8",
    );

    const config = loadConfig();

    expect(config.dotenv.path).toBe(join(stateDir, ".env"));
    expect(config.dotenv.exists).toBe(true);
    expect(config.dotenv.loaded).toContain("ATOMIC_LOADCONFIG_TEST_KEY");
    expect(config.dotenv.error).toBeNull();
    expect(process.env.ATOMIC_LOADCONFIG_TEST_KEY).toBe("from-file");
  });

  it("reports an unreadable .env in config.dotenv.error without throwing", () => {
    // A directory named `.env` is the portable stand-in for a file that
    // exists but cannot be read: readFileSync fails with EISDIR on POSIX
    // and an access-denied flavour on Windows. Real EPERM needs ACL
    // tricks that do not survive root test runs or CI images.
    mkdirSync(join(stateDir, ".env"));

    const config = loadConfig();

    expect(config.dotenv.exists).toBe(false);
    expect(config.dotenv.loaded).toEqual([]);
    expect(config.dotenv.error).not.toBeNull();
    expect(config.dotenv.error?.code).toMatch(/^(EISDIR|EACCES|EPERM)$/);
    expect(config.dotenv.error?.attempts).toBeGreaterThanOrEqual(1);
  });

  it("uses localModelsDataDir override when set", () => {
    const override = join(stateDir, "custom-local-llm");
    writeUserConfigFileSync(getUserConfigPath(stateDir), {
      ...USER_CONFIG_DEFAULTS,
      localModels: {
        ...USER_CONFIG_DEFAULTS.localModels,
        managed: {
          ...USER_CONFIG_DEFAULTS.localModels.managed,
          dataDirOverride: override,
        },
      },
    });
    resetConfigCache();
    expect(loadConfig().paths.localModelsDataDir).toBe(override);
  });

  it("resolves grammarsDir without consulting the working directory", () => {
    // The Ctrl+N "new terminal window" spawn starts the agent by absolute
    // path from the operator's home, so cwd holds no `grammars/` and the
    // old cwd-relative default died on ENOENT tool-call.gbnf. Standing in
    // an empty temp dir reproduces exactly that shape.
    const elsewhere = mkdtempSync(join(tmpdir(), "atomic-cwd-"));
    const originalCwd = process.cwd();
    try {
      process.chdir(elsewhere);
      resetConfigCache();
      const grammarsDir = loadConfig().paths.grammarsDir;
      expect(grammarsDir.startsWith(elsewhere)).toBe(false);
      expect(existsSync(join(grammarsDir, "tool-call.gbnf"))).toBe(true);
    } finally {
      process.chdir(originalCwd);
      rmSync(elsewhere, { recursive: true, force: true });
    }
  });

  it("still lets ATOMIC_AGENT_GRAMMARS_DIR win over the packaged copy", () => {
    const override = join(stateDir, "custom-grammars");
    mkdirSync(override);
    process.env.ATOMIC_AGENT_GRAMMARS_DIR = override;
    resetConfigCache();
    expect(loadConfig().paths.grammarsDir).toBe(override);
  });

  it("lets H0X_CLI_GRAMMARS_DIR override the legacy grammars env var", () => {
    const legacy = join(stateDir, "legacy-grammars");
    const h0x = join(stateDir, "h0x-grammars");
    mkdirSync(legacy);
    mkdirSync(h0x);
    process.env.ATOMIC_AGENT_GRAMMARS_DIR = legacy;
    process.env.H0X_CLI_GRAMMARS_DIR = h0x;
    resetConfigCache();
    expect(loadConfig().paths.grammarsDir).toBe(h0x);
  });

  it("lets H0X_CLI env vars override remaining legacy-only runtime knobs", () => {
    process.env.ATOMIC_AGENT_REPO = "AtomicBot-ai/atomic-agent";
    process.env.H0X_CLI_REPO = "vjk7989/h0x-cli-v3";
    process.env.ATOMIC_AGENT_TASKS_ENABLED = "0";
    process.env.H0X_CLI_TASKS_ENABLED = "1";
    process.env.ATOMIC_AGENT_BROWSER_CDP_URL = "http://legacy.example/cdp";
    process.env.H0X_CLI_BROWSER_CDP_URL = "http://h0x.example/cdp";
    resetConfigCache();

    const config = loadConfig();

    expect(config.update.repo).toBe("vjk7989/h0x-cli-v3");
    expect(config.tasks.enabled).toBe(true);
    expect(config.browser.cdpUrl).toBe("http://h0x.example/cdp");
  });

  it("keeps legacy env vars working for update, task, and browser knobs", () => {
    process.env.ATOMIC_AGENT_REPO = "legacy/repo";
    process.env.ATOMIC_AGENT_TASKS_ENABLED = "0";
    process.env.ATOMIC_AGENT_BROWSER_CDP_URL = "http://legacy.example/cdp";
    resetConfigCache();

    const config = loadConfig();

    expect(config.update.repo).toBe("legacy/repo");
    expect(config.tasks.enabled).toBe(false);
    expect(config.browser.cdpUrl).toBe("http://legacy.example/cdp");
  });

  it("uses the h0x stable-prefix salt by default and lets H0X_CLI override legacy", () => {
    resetConfigCache();
    expect(loadConfig().agent.stablePrefixHashSalt).toBe("h0x-cli-v1");

    process.env.ATOMIC_AGENT_STABLE_PREFIX_SALT = "legacy-salt";
    resetConfigCache();
    expect(loadConfig().agent.stablePrefixHashSalt).toBe("legacy-salt");

    process.env.H0X_CLI_STABLE_PREFIX_SALT = "h0x-salt";
    resetConfigCache();
    expect(loadConfig().agent.stablePrefixHashSalt).toBe("h0x-salt");
  });
});
