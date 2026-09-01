import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildSpawnAgentEnv } from "../../eval/harness/spawn-agent.js";

describe("buildSpawnAgentEnv", () => {
  it("pins both h0x and legacy state variables to the per-case state dir", () => {
    const previousH0x = process.env.H0X_CLI_STATE_DIR;
    const previousLegacy = process.env.ATOMIC_AGENT_STATE_DIR;
    process.env.H0X_CLI_STATE_DIR = resolve("G:\\h0xi\\atomic-agent", "tmp", "wrong-h0x");
    process.env.ATOMIC_AGENT_STATE_DIR = resolve("G:\\h0xi\\atomic-agent", "tmp", "wrong-legacy");

    try {
      const stateDir = resolve("G:\\h0xi\\atomic-agent", "tmp", "gaia-case-state");
      const env = buildSpawnAgentEnv(stateDir);

      expect(env.H0X_CLI_STATE_DIR).toBe(stateDir);
      expect(env.ATOMIC_AGENT_STATE_DIR).toBe(stateDir);
      expect(env.H0X_CLI_EVAL_DISABLE_PACKAGE_INSTALLS).toBe("1");
      expect(env.H0X_CLI_EVAL_DISABLE_SESSION_SAVE).toBe("1");
      expect(env.H0X_CLI_EVAL_EXIT_GRACE_MS).toBe("250");
      expect(env.PYTHONIOENCODING).toBe("utf-8");
      expect(env.XDG_CACHE_HOME).toBe(resolve("G:\\h0xi\\atomic-agent", "tmp", "cache"));
      expect(env.PATH?.split(";")[0]).toBe(resolve("G:\\h0xi\\atomic-agent", ".local", "bin"));
      expect(env.NO_COLOR).toBe("1");
      expect(env.FORCE_COLOR).toBe("0");
    } finally {
      restoreEnv("H0X_CLI_STATE_DIR", previousH0x);
      restoreEnv("ATOMIC_AGENT_STATE_DIR", previousLegacy);
    }
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
