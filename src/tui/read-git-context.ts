import { execFile } from "node:child_process";
import { basename } from "node:path";
import { promisify } from "node:util";

export interface GitContext { name: string; branch: string }
const execute = promisify(execFile);

/** A bounded, read-only probe. Missing Git or an unreadable repo is not a UI error. */
export async function readGitContext(
  workingDir: string,
  signal?: AbortSignal,
): Promise<GitContext | null> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) return null;
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 2_000);
  const git = async (...args: string[]) => {
    const { stdout } = await execute("git", args, {
      cwd: workingDir, encoding: "utf8", windowsHide: true,
      signal: controller.signal, timeout: 2_000, maxBuffer: 64 * 1024,
    });
    return stdout.trim().replace(/[\x00-\x1f\x7f-\x9f]/g, "");
  };
  try {
    const root = await git("rev-parse", "--show-toplevel");
    let branch: string;
    try {
      branch = await git("symbolic-ref", "--quiet", "--short", "HEAD");
    } catch {
      if (controller.signal.aborted) return null;
      branch = `detached ${await git("rev-parse", "--short", "HEAD")}`;
    }
    return root && branch ? { name: basename(root), branch } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
