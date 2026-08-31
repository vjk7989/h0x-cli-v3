import { Text } from "ink";
import { render } from "ink-testing-library";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GitContext } from "../read-git-context.js";
import { useGitContext } from "./use-git-context.js";

const read = vi.hoisted(() => vi.fn<(cwd: string, signal?: AbortSignal) => Promise<GitContext | null>>());
vi.mock("../read-git-context.js", () => ({ readGitContext: read }));

interface Pending {
  cwd: string;
  signal: AbortSignal | undefined;
  resolve: (context: GitContext | null) => void;
}

let pending: Pending[];
let seen: Array<GitContext | null>;
const views: Array<ReturnType<typeof render>> = [];

function Probe({ cwd, refreshKey }: { cwd: string; refreshKey: unknown }) {
  const git = useGitContext(cwd, refreshKey);
  useEffect(() => { seen.push(git); }, [git]);
  return <Text>{git ? git.name + ":" + git.branch : "no git"}</Text>;
}

function mount(cwd = "G:/work/a", refreshKey: unknown = "idle") {
  const view = render(<Probe cwd={cwd} refreshKey={refreshKey} />);
  views.push(view);
  return view;
}

beforeEach(() => {
  pending = [];
  seen = [];
  read.mockReset().mockImplementation((cwd, signal) => new Promise((resolve) => {
    pending.push({ cwd, signal, resolve });
  }));
});

afterEach(() => {
  for (const view of views.splice(0)) view.unmount();
});

// Let promise callbacks and React's scheduled updates finish before checking a
// response that must not cause a render. Positive assertions use waitFor below.
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50));
}

describe("useGitContext", () => {
  it("starts empty, supplies cancellation and publishes the repository result", async () => {
    const view = mount();
    expect(view.lastFrame()).toContain("no git");
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    expect(pending[0]?.cwd).toBe("G:/work/a");
    expect(pending[0]?.signal).toBeInstanceOf(AbortSignal);
    expect(pending[0]?.signal?.aborted).toBe(false);
    pending[0]!.resolve({ name: "a", branch: "main" });
    await vi.waitFor(() => expect(view.lastFrame()).toContain("a:main"));
  });

  it("hides the previous directory immediately while a new directory is pending", async () => {
    const view = mount();
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    pending[0]!.resolve({ name: "a", branch: "main" });
    await vi.waitFor(() => expect(view.lastFrame()).toContain("a:main"));
    view.rerender(<Probe cwd="G:/work/b" refreshKey="idle" />);
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[0]?.signal?.aborted).toBe(true);
    await vi.waitFor(() => expect(view.lastFrame()).toContain("no git"));
    pending[1]!.resolve({ name: "b", branch: "next" });
    await vi.waitFor(() => expect(view.lastFrame()).toContain("b:next"));
  });

  it("ignores an old directory's late response even if its reader ignores abort", async () => {
    const view = mount();
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    view.rerender(<Probe cwd="G:/work/b" refreshKey="idle" />);
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    pending[1]!.resolve({ name: "b", branch: "current" });
    await vi.waitFor(() => expect(view.lastFrame()).toContain("b:current"));
    pending[0]!.resolve({ name: "a", branch: "stale" });
    await settle();
    expect(seen.at(-1)).toEqual({ name: "b", branch: "current" });
    expect(seen).not.toContainEqual({ name: "a", branch: "stale" });
  });

  it("refreshes the same directory and rejects an older refresh result", async () => {
    const view = mount();
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    view.rerender(<Probe cwd="G:/work/a" refreshKey="completed" />);
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[0]?.signal?.aborted).toBe(true);
    pending[1]!.resolve({ name: "a", branch: "new-branch" });
    await vi.waitFor(() => expect(view.lastFrame()).toContain("a:new-branch"));
    pending[0]!.resolve({ name: "a", branch: "old-branch" });
    await settle();
    expect(seen.at(-1)).toEqual({ name: "a", branch: "new-branch" });
    expect(seen).not.toContainEqual({ name: "a", branch: "old-branch" });
  });

  it("clears a previously resolved context when the next probe returns null", async () => {
    const view = mount();
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    pending[0]!.resolve({ name: "a", branch: "main" });
    await vi.waitFor(() => expect(view.lastFrame()).toContain("a:main"));
    view.rerender(<Probe cwd="G:/work/a" refreshKey="refresh" />);
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    pending[1]!.resolve(null);
    await vi.waitFor(() => expect(view.lastFrame()).toContain("no git"));
  });

  it("does not reprobe when neither directory nor refresh key changes", async () => {
    const view = mount();
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    view.rerender(<Probe cwd="G:/work/a" refreshKey="idle" />);
    await settle();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("aborts on unmount without publishing a late result", async () => {
    const view = mount();
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    view.unmount();
    await vi.waitFor(() => expect(pending[0]?.signal?.aborted).toBe(true));
    const before = [...seen];
    pending[0]!.resolve({ name: "a", branch: "too-late" });
    await settle();
    expect(seen).toEqual(before);
  });
});
