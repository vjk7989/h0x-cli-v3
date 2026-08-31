import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readGitContext } from "./read-git-context.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const tempRoot = join(repoRoot, ".local", "tmp");

describe("readGitContext with real Git repositories", () => {
  let sandbox: string;
  let repo: string;

  function git(cwd: string, ...args: string[]): string {
    return execFileSync("git", [
      "-c", "user.name=Git Context Test", "-c", "user.email=test@example.invalid",
      "-c", "commit.gpgsign=false", "-c", "core.hooksPath=" + join(sandbox, "no-hooks"),
      ...args,
    ], { cwd, encoding: "utf8", windowsHide: true, timeout: 5000 }).trim();
  }

  beforeEach(() => {
    mkdirSync(tempRoot, { recursive: true });
    sandbox = mkdtempSync(join(tempRoot, "git-context-"));
    repo = join(sandbox, "sample repo");
    mkdirSync(repo);
    // Prevent non-repository fixtures from discovering this project's .git.
    vi.stubEnv("GIT_CEILING_DIRECTORIES", sandbox);
    vi.stubEnv("GIT_CONFIG_NOSYSTEM", "1");
    vi.stubEnv("GIT_CONFIG_GLOBAL", process.platform === "win32" ? "NUL" : "/dev/null");
    git(repo, "init", "--initial-branch=main", "--template=");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    const withinTemp = relative(tempRoot, resolve(sandbox));
    if (!withinTemp || withinTemp.startsWith("..")) throw new Error("Unsafe fixture cleanup path");
    rmSync(sandbox, { recursive: true, force: true });
  });

  it("reads an unborn repository without requiring a commit", async () => {
    expect(await readGitContext(repo)).toEqual({ name: "sample repo", branch: "main" });
  });

  it("finds the repository root from a nested directory with spaces", async () => {
    const nested = join(repo, "src", "nested dir");
    mkdirSync(nested, { recursive: true });
    expect(await readGitContext(nested)).toEqual({ name: "sample repo", branch: "main" });
  });

  it("observes a branch change on the next read without modifying the repository", async () => {
    git(repo, "commit", "--allow-empty", "-m", "fixture");
    expect((await readGitContext(repo))?.branch).toBe("main");
    git(repo, "checkout", "-b", "feature/context");
    const before = git(repo, "status", "--porcelain=v1");
    expect(await readGitContext(repo)).toEqual({ name: "sample repo", branch: "feature/context" });
    expect(git(repo, "status", "--porcelain=v1")).toBe(before);
    expect(git(repo, "symbolic-ref", "--short", "HEAD")).toBe("feature/context");
  });

  it("labels detached HEAD with its short commit id", async () => {
    git(repo, "commit", "--allow-empty", "-m", "fixture");
    git(repo, "checkout", "--detach", "HEAD");
    const short = git(repo, "rev-parse", "--short", "HEAD");
    expect(await readGitContext(repo)).toEqual({ name: "sample repo", branch: "detached " + short });
  });

  it("reads a linked worktree's own branch and directory name", async () => {
    git(repo, "commit", "--allow-empty", "-m", "fixture");
    const worktree = join(sandbox, "linked worktree");
    git(repo, "worktree", "add", "-b", "worktree-branch", worktree);
    expect(await readGitContext(worktree)).toEqual({ name: basename(worktree), branch: "worktree-branch" });
    expect((await readGitContext(repo))?.branch).toBe("main");
  });

  it("returns null outside a repository", async () => {
    const plain = join(sandbox, "plain");
    mkdirSync(plain);
    expect(await readGitContext(plain)).toBeNull();
  });
});

describe("readGitContext process failures", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.doUnmock("node:child_process");
    vi.resetModules();
  });

  async function mockedReader(execFile: ReturnType<typeof vi.fn>) {
    vi.resetModules();
    vi.doMock("node:child_process", () => ({ execFile }));
    return (await import("./read-git-context.js")).readGitContext;
  }

  it("returns null when Git is not installed", async () => {
    const execFile = vi.fn((_file, _args, _options, callback) => {
      callback(Object.assign(new Error("Git unavailable"), { code: "ENOENT" }));
    });
    const read = await mockedReader(execFile);
    await expect(read(repoRoot)).resolves.toBeNull();
    expect(execFile).toHaveBeenCalledTimes(1);
    expect(execFile.mock.calls[0]?.[0]).toBe("git");
  });

  it("aborts a stalled probe after two seconds and bounds the child process", async () => {
    vi.useFakeTimers();
    const execFile = vi.fn((_file, _args, options, callback) => {
      options.signal.addEventListener("abort", () => callback(new Error("aborted")), { once: true });
    });
    const read = await mockedReader(execFile);
    const result = read(repoRoot);
    expect(execFile.mock.calls[0]?.[2]).toMatchObject({ cwd: repoRoot, timeout: 2000, windowsHide: true });
    expect(execFile.mock.calls[0]?.[2].shell).not.toBe(true);
    await vi.advanceTimersByTimeAsync(1999);
    expect(execFile.mock.calls[0]?.[2].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBeNull();
    expect(execFile.mock.calls[0]?.[2].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("honours caller cancellation and removes its listener", async () => {
    const execFile = vi.fn((_file, _args, options, callback) => {
      options.signal.addEventListener("abort", () => callback(new Error("aborted")), { once: true });
    });
    const read = await mockedReader(execFile);
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const result = read(repoRoot, controller.signal);
    controller.abort();
    await expect(result).resolves.toBeNull();
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    remove.mockRestore();
  });

  it("does not spawn Git for an already cancelled request", async () => {
    const execFile = vi.fn();
    const read = await mockedReader(execFile);
    const controller = new AbortController();
    controller.abort();
    expect(await read(repoRoot, controller.signal)).toBeNull();
    expect(execFile).not.toHaveBeenCalled();
  });
});
