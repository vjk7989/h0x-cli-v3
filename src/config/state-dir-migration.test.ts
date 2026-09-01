import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

let homeDir: string;
let rootDir: string;
const originalAtomicStateDir = process.env.ATOMIC_AGENT_STATE_DIR;
const originalH0xStateDir = process.env.H0X_CLI_STATE_DIR;

async function importFreshConfig() {
  vi.resetModules();
  vi.doMock("node:os", async () => {
    const actual = await vi.importActual<typeof import("node:os")>("node:os");
    return { ...actual, homedir: () => homeDir };
  });
  return import("./load-config.js");
}

function writeConfig(path: string, level: "debug" | "info" | "warn"): void {
  mkdirSync(path, { recursive: true });
  writeFileSync(
    join(path, "config.json"),
    JSON.stringify(
      {
        version: 45,
        log: { level },
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

describe("state dir migration (h0x deep rebrand)", () => {
  beforeEach(() => {
    rootDir = join(process.cwd(), "tmp", `state-dir-migration-${randomUUID()}`);
    homeDir = join(rootDir, "home");
    mkdirSync(homeDir, { recursive: true });
    delete process.env.ATOMIC_AGENT_STATE_DIR;
    delete process.env.H0X_CLI_STATE_DIR;
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    if (originalAtomicStateDir === undefined) {
      delete process.env.ATOMIC_AGENT_STATE_DIR;
    } else {
      process.env.ATOMIC_AGENT_STATE_DIR = originalAtomicStateDir;
    }
    if (originalH0xStateDir === undefined) {
      delete process.env.H0X_CLI_STATE_DIR;
    } else {
      process.env.H0X_CLI_STATE_DIR = originalH0xStateDir;
    }
    vi.doUnmock("node:os");
    vi.restoreAllMocks();
    rmSync(rootDir, { recursive: true, force: true });
  });

  it("migrates an old default ~/.atomic-agent config into the new ~/.h0x-cli state dir", async () => {
    const legacyDir = join(homeDir, ".atomic-agent");
    const h0xDir = join(homeDir, ".h0x-cli");
    writeConfig(legacyDir, "debug");
    writeFileSync(join(legacyDir, "legacy-sentinel.txt"), "keep me", "utf8");
    const { loadConfig } = await importFreshConfig();

    const config = loadConfig();

    expect(config.paths.stateDir).toBe(h0xDir);
    expect(config.paths.userConfigFile).toBe(join(h0xDir, "config.json"));
    expect(config.log.level).toBe("debug");
    expect(JSON.parse(readFileSync(join(h0xDir, "config.json"), "utf8")).log.level).toBe(
      "debug",
    );
    expect(readFileSync(join(legacyDir, "legacy-sentinel.txt"), "utf8")).toBe(
      "keep me",
    );
  });

  it("does not overwrite existing h0x state data when legacy state also exists", async () => {
    const legacyDir = join(homeDir, ".atomic-agent");
    const h0xDir = join(homeDir, ".h0x-cli");
    writeConfig(legacyDir, "debug");
    writeConfig(h0xDir, "warn");
    const { loadConfig } = await importFreshConfig();

    const config = loadConfig();

    expect(config.paths.stateDir).toBe(h0xDir);
    expect(config.log.level).toBe("warn");
    expect(JSON.parse(readFileSync(join(legacyDir, "config.json"), "utf8")).log.level).toBe(
      "debug",
    );
    expect(JSON.parse(readFileSync(join(h0xDir, "config.json"), "utf8")).log.level).toBe(
      "warn",
    );
  });

  it("creates a new default config under ~/.h0x-cli when no legacy state exists", async () => {
    const h0xDir = join(homeDir, ".h0x-cli");
    const { loadConfig } = await importFreshConfig();

    const config = loadConfig();

    expect(config.paths.stateDir).toBe(h0xDir);
    expect(existsSync(join(h0xDir, "config.json"))).toBe(true);
    expect(existsSync(join(homeDir, ".atomic-agent", "config.json"))).toBe(false);
  });
});
