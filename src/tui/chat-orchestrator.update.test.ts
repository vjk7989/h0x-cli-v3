import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentRuntime } from "../runtime/bootstrap.js";
import { ChatOrchestrator } from "./chat-orchestrator.js";
import { makeTuiEventBus } from "./make-event-bus.js";
import type { TuiAction } from "./tui-action.js";

const check = vi.hoisted(() => vi.fn());
vi.mock("../update/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../update/index.js")>();
  return { ...actual, checkForAppUpdate: check.mockImplementation(actual.checkForAppUpdate) };
});

describe("fork startup update gate", () => {
  afterEach(() => { vi.unstubAllGlobals(); check.mockClear(); });

  it("does not fetch or offer an update when inherited upstream settings enable startup checks", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("Unexpected startup update request"));
    vi.stubGlobal("fetch", fetch);
    const runtime = {
      config: { update: { checkOnStartup: true, repo: "AtomicBot-ai/atomic-agent" } },
      sessionStore: { listRecent: () => [], load: () => null },
      profileStore: { list: () => [] },
      skillCatalog: [],
    } as unknown as AgentRuntime;
    const bus = makeTuiEventBus();
    const actions: TuiAction[] = [];
    const unsubscribe = bus.subscribe((action) => actions.push(action));
    const orchestrator = new ChatOrchestrator(runtime, bus, {
      maxSteps: 5, llamaUrl: "http://127.0.0.1:8080",
    });
    const execPath = Object.getOwnPropertyDescriptor(process, "execPath")!;
    Object.defineProperty(process, "execPath", {
      ...execPath,
      value: process.platform === "win32" ? "G:\\tools\\atomic-agent.exe" : "/opt/bin/atomic-agent",
    });
    try {
      await expect(orchestrator.checkForUpdate()).resolves.toBeUndefined();
      await expect(orchestrator.checkForUpdate()).resolves.toBeUndefined();
      expect(fetch).not.toHaveBeenCalled();
      expect(check).not.toHaveBeenCalled();
      expect(actions.filter((action) => action.type === "update_available")).toEqual([]);
    } finally {
      Object.defineProperty(process, "execPath", execPath);
      unsubscribe();
    }
  });
});
