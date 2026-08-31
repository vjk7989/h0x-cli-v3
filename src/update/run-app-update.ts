import { win32 as pathWin32 } from "node:path";
import { APP_UPDATE_UNAVAILABLE } from "./check-app-update.js";

export interface RunAppUpdateOptions {
  repo?: string;
  /** Optional tag to pin (e.g. `v0.1.40`); omit for latest. */
  version?: string;
  /** Streamed install-script output, one trimmed line at a time. */
  onLine?: (line: string) => void;
  signal?: AbortSignal;
}

export interface RunAppUpdateResult {
  ok: boolean;
  installDir: string;
}

export class AppUpdateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppUpdateError";
  }
}

/**
 * Compose the failure message for a non-zero installer exit. The exit code on
 * its own is not actionable, and the streamed `onLine` output lands in the
 * runtime feed rather than next to the failed-update notice — so the reason has
 * to be attached to the error itself. Pure, so the formatting is unit-testable.
 */
export function formatInstallFailure(
  code: number | null,
  tail: readonly string[],
): string {
  const header = `install script exited with code ${code ?? "unknown"}`;
  if (tail.length === 0) return `${header} (no output)`;
  return [header, ...tail.map((line) => `  ${line}`)].join("\n");
}

/** No binary is self-updatable until h0x-cli distribution is configured. */
export function canSelfUpdate(
  _platform: NodeJS.Platform = process.platform,
  _execPath: string = process.execPath,
): boolean {
  return false;
}

export interface UpdateInvocation {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

/**
 * Absolute path to the system Windows PowerShell, falling back to a bare
 * `powershell.exe` when %SystemRoot% is not set.
 *
 * A bare name is resolved against the inherited PATH, which is the user's,
 * not ours. When that PATH puts a trimmed, relocated or 2.0-engine shell
 * first, the installer loses the Utility/Archive modules and dies on
 * "'Get-FileHash' is not recognized" — while the very same update run from
 * `cmd` succeeds, because there the name resolves to the system copy
 * (issue #174). Naming the system copy outright removes that variance;
 * install.ps1 no longer depends on those modules either, so the two fixes
 * are belt and braces.
 */
function windowsPowerShellPath(env: NodeJS.ProcessEnv): string {
  const systemRoot = env.SystemRoot ?? env.SYSTEMROOT ?? env.systemroot;
  if (!systemRoot) return "powershell.exe";
  return pathWin32.join(
    systemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
}

/**
 * Build the platform-specific process invocation that re-runs the
 * canonical installer against the current install dir. Pure — no I/O —
 * so it is unit-testable without spawning anything.
 *
 * - POSIX: `sh -c "curl -fsSL .../install.sh | sh"`.
 * - Windows: `%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe
 *   -Command "irm .../install.ps1 | iex"` — see {@link windowsPowerShellPath}.
 *
 * Both pin the install dir to the running binary's directory and
 * suppress the PATH edit (already present on an upgrade). The installer
 * itself handles checksum verification, extraction, and — on Windows —
 * the locked-file swap that makes in-place self-update possible.
 */
export function buildUpdateInvocation(params: {
  platform: NodeJS.Platform;
  repo: string;
  installDir: string;
  version?: string;
  baseEnv?: NodeJS.ProcessEnv;
}): UpdateInvocation {
  const { platform, repo, installDir, version } = params;
  const baseEnv = params.baseEnv ?? process.env;
  const env: NodeJS.ProcessEnv = {
    ...baseEnv,
    ATOMIC_AGENT_REPO: repo,
    ATOMIC_AGENT_INSTALL_DIR: installDir,
    // The PATH entry already exists on an upgrade; don't touch it.
    ATOMIC_AGENT_NO_PATH: "1",
    ...(version ? { ATOMIC_AGENT_VERSION: version } : {}),
  };

  if (platform === "win32") {
    const scriptUrl = `https://raw.githubusercontent.com/${repo}/main/scripts/install.ps1`;
    return {
      command: windowsPowerShellPath(baseEnv),
      args: [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `irm '${scriptUrl}' | iex`,
      ],
      env,
    };
  }

  const scriptUrl = `https://raw.githubusercontent.com/${repo}/main/scripts/install.sh`;
  // `curl ... | sh` mirrors the documented install path exactly so the
  // updater never drifts from the canonical installer.
  return { command: "sh", args: ["-c", `curl -fsSL ${scriptUrl} | sh`], env };
}

/** Fail closed, including explicit tags and legacy upstream configuration. */
export async function runAppUpdate(
  _opts?: RunAppUpdateOptions,
): Promise<RunAppUpdateResult> {
  throw new AppUpdateError(APP_UPDATE_UNAVAILABLE);
}
