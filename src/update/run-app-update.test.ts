import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  canSelfUpdate,
  buildUpdateInvocation,
  formatInstallFailure,
  runAppUpdate,
  AppUpdateError,
} from "./run-app-update.js";
import { APP_UPDATE_UNAVAILABLE } from "./check-app-update.js";

const RELEASE_MIRROR_REPO = "buckleson/Pavii-cli-releases";

const spawn = vi.hoisted(() => vi.fn(() => { throw new Error("Unexpected installer spawn"); }));
vi.mock("node:child_process", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:child_process")>()), spawn,
}));

describe("canSelfUpdate", () => {
  it("disables installed legacy binaries on POSIX", () => {
    expect(canSelfUpdate("linux", "/home/u/.local/bin/atomic-agent")).toBe(false);
    expect(canSelfUpdate("darwin", "/Users/u/.local/bin/atomic-agent")).toBe(
      false,
    );
  });

  it("disables installed legacy binaries on Windows", () => {
    expect(
      canSelfUpdate("win32", "C:\\Users\\u\\AppData\\Local\\atomic-agent\\atomic-agent.exe"),
    ).toBe(false);
  });

  it("rejects dev runtimes (node / tsx)", () => {
    expect(canSelfUpdate("linux", "/usr/bin/node")).toBe(false);
    expect(canSelfUpdate("win32", "C:\\Program Files\\nodejs\\node.exe")).toBe(
      false,
    );
    expect(canSelfUpdate("darwin", "/opt/homebrew/bin/tsx")).toBe(false);
  });

  it("rejects unrelated binaries", () => {
    expect(canSelfUpdate("linux", "/usr/bin/bash")).toBe(false);
  });

  it.each(["win32", "linux", "darwin", "freebsd"] as const)("disables every invocation name on %s", (platform) => {
    for (const name of ["h0x-cli", "h0x-cli.exe", "atomic-agent", "atomic-agent.exe", "atag", "node", "tsx"]) {
      const path = platform === "win32" ? "G:\\tools\\" + name : "/opt/bin/" + name;
      expect(canSelfUpdate(platform, path)).toBe(false);
    }
    expect(canSelfUpdate()).toBe(false);
  });
});

describe("fork installer execution", () => {
  beforeEach(() => { spawn.mockClear(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it.each([undefined, { repo: "AtomicBot-ai/atomic-agent" }, { repo: "fork/example", version: "v9.9.9" }])(
    "refuses %j with the shared error without fetching or spawning", async (options) => {
      const fetch = vi.fn().mockRejectedValue(new Error("Unexpected installer fetch"));
      vi.stubGlobal("fetch", fetch);
      vi.stubEnv("ATOMIC_AGENT_REPO", "AtomicBot-ai/atomic-agent");
      vi.stubEnv("H0X_CLI_REPO", RELEASE_MIRROR_REPO);
      const failure = await runAppUpdate(options).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(AppUpdateError);
      expect(failure).toMatchObject({ message: APP_UPDATE_UNAVAILABLE });
      expect(fetch).not.toHaveBeenCalled();
      expect(spawn).not.toHaveBeenCalled();
    },
  );

  it("does not emit installer progress even for a pinned, cancelled request", async () => {
    const onLine = vi.fn();
    const controller = new AbortController();
    controller.abort();
    await expect(runAppUpdate({ version: "v9.9.9", onLine, signal: controller.signal }))
      .rejects.toThrow(APP_UPDATE_UNAVAILABLE);
    expect(onLine).not.toHaveBeenCalled();
    expect(spawn).not.toHaveBeenCalled();
  });
});

describe("buildUpdateInvocation", () => {
  it("builds a POSIX sh invocation against install.sh", () => {
    const inv = buildUpdateInvocation({
      platform: "linux",
      repo: RELEASE_MIRROR_REPO,
      installDir: "/home/u/.local/bin",
      baseEnv: {},
    });
    expect(inv.command).toBe("sh");
    expect(inv.args[0]).toBe("-c");
    expect(inv.args[1]).toContain("install.sh");
    expect(inv.args[1]).toContain("curl -fsSL");
    expect(inv.args[1]).toContain("| sh");
    expect(inv.env.H0X_CLI_INSTALL_DIR).toBe("/home/u/.local/bin");
    expect(inv.env.H0X_CLI_NO_PATH).toBe("1");
    expect(inv.env.H0X_CLI_REPO).toBe(RELEASE_MIRROR_REPO);
    expect(inv.env.H0X_CLI_VERSION).toBeUndefined();
    expect(inv.env.ATOMIC_AGENT_REPO).toBeUndefined();
  });

  it("builds a Windows powershell invocation against install.ps1", () => {
    const inv = buildUpdateInvocation({
      platform: "win32",
      repo: RELEASE_MIRROR_REPO,
      installDir: "C:\\Users\\u\\AppData\\Local\\h0x-cli",
      baseEnv: {},
    });
    // No %SystemRoot% to resolve against: fall back to the bare name.
    expect(inv.command).toBe("powershell.exe");
    expect(inv.args).toContain("-NoProfile");
    expect(inv.args).toContain("-Command");
    const psCommand = inv.args[inv.args.length - 1];
    expect(psCommand).toContain("install.ps1");
    expect(psCommand).toContain("irm ");
    expect(psCommand).toContain("| iex");
    expect(inv.env.H0X_CLI_INSTALL_DIR).toBe(
      "C:\\Users\\u\\AppData\\Local\\h0x-cli",
    );
    expect(inv.env.H0X_CLI_NO_PATH).toBe("1");
  });

  // Regression: the user's PATH decides what a bare `powershell.exe` means,
  // and a trimmed or 2.0-engine shell there breaks the installer while the
  // same update works from cmd (issue #174). Name the system copy outright.
  it("runs the system PowerShell by absolute path when SystemRoot is set", () => {
    const inv = buildUpdateInvocation({
      platform: "win32",
      repo: RELEASE_MIRROR_REPO,
      installDir: "C:\\Users\\u\\AppData\\Local\\h0x-cli",
      baseEnv: { SystemRoot: "C:\\Windows" },
    });
    expect(inv.command).toBe(
      "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    );
    expect(inv.args).toContain("-NoProfile");
    expect(inv.args[inv.args.length - 1]).toContain("install.ps1");
  });

  it("accepts an upper-case SYSTEMROOT spelling", () => {
    const inv = buildUpdateInvocation({
      platform: "win32",
      repo: RELEASE_MIRROR_REPO,
      installDir: "C:\\x",
      baseEnv: { SYSTEMROOT: "D:\\Windows" },
    });
    expect(inv.command).toBe(
      "D:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    );
  });

  it("leaves the POSIX invocation untouched when SystemRoot is present", () => {
    const inv = buildUpdateInvocation({
      platform: "darwin",
      repo: RELEASE_MIRROR_REPO,
      installDir: "/usr/local/bin",
      baseEnv: { SystemRoot: "C:\\Windows" },
    });
    expect(inv.command).toBe("sh");
  });

  it("pins a version when provided", () => {
    const inv = buildUpdateInvocation({
      platform: "win32",
      repo: RELEASE_MIRROR_REPO,
      installDir: "C:\\x",
      version: "v0.1.60",
      baseEnv: {},
    });
    expect(inv.env.H0X_CLI_VERSION).toBe("v0.1.60");
  });

  it("preserves the base environment", () => {
    const inv = buildUpdateInvocation({
      platform: "linux",
      repo: "owner/repo",
      installDir: "/x",
      baseEnv: { HOME: "/home/u", PATH: "/usr/bin" },
    });
    expect(inv.env.HOME).toBe("/home/u");
    expect(inv.env.PATH).toBe("/usr/bin");
    expect(inv.env.H0X_CLI_REPO).toBe("owner/repo");
  });
});

describe("formatInstallFailure", () => {
  it("should attach the installer's own reason to the exit code", () => {
    const message = formatInstallFailure(1, [
      `downloading h0x-cli-win32-x64.zip from ${RELEASE_MIRROR_REPO} ...`,
      "error: download failed: https://github.com/o/r/releases/latest/download/a.zip",
    ]);
    expect(message).toContain("install script exited with code 1");
    expect(message).toContain("error: download failed:");
    expect(message.split("\n")).toHaveLength(3);
  });

  it("should say so explicitly when the installer produced no output", () => {
    expect(formatInstallFailure(1, [])).toBe(
      "install script exited with code 1 (no output)",
    );
  });

  it("should render a null exit code (killed by signal) without crashing", () => {
    expect(formatInstallFailure(null, ["boom"])).toContain(
      "exited with code unknown",
    );
  });
});
