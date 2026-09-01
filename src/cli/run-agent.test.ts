import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Interface as ReadlineInterface } from "node:readline";
import { Readable } from "node:stream";

import type { CompletionResult } from "../llm/llama-server-client.js";
import { resetConfigCache } from "../config/index.js";

import { formatLlamaUnreachableHint } from "../llm/llama-server-health.js";
import { SessionStore } from "../session/session-store.js";
import { formatAgentEvent } from "./run-agent.js";

const HINT = formatLlamaUnreachableHint("http://127.0.0.1:8080");

function transportError(message: string) {
  return {
    type: "llm_event" as const,
    event: {
      type: "step_error" as const,
      error: new Error(message),
      category: "transport" as const,
    },
  };
}

describe("formatAgentEvent llama hint", () => {
  it("turns a bare transport failure into something actionable on the local route", () => {
    const line = formatAgentEvent(transportError("fetch failed"), {
      llamaHint: HINT,
      hintShown: { value: false },
    });
    expect(line).toContain("! [transport] fetch failed");
    expect(line).toContain("llama-server is not reachable at http://127.0.0.1:8080");
    expect(line).toContain("h0x-cli models start");
    expect(line).toContain("h0x-cli config set localModels.url <url>");
  });

  it("prints the hint once, not on every retry", () => {
    const hintShown = { value: false };
    const first = formatAgentEvent(transportError("fetch failed"), {
      llamaHint: HINT,
      hintShown,
    });
    const second = formatAgentEvent(transportError("fetch failed"), {
      llamaHint: HINT,
      hintShown,
    });
    expect(first).toContain("llama-server is not reachable");
    expect(second).toBe("  ! [transport] fetch failed");
  });

  it("stays out of the way on a cloud route", () => {
    // No hint is computed when the active text provider is not local —
    // a transport failure there points at the provider, not at llama.
    const line = formatAgentEvent(transportError("fetch failed"), {
      llamaHint: null,
      hintShown: { value: false },
    });
    expect(line).toBe("  ! [transport] fetch failed");
  });

  it("stays out of the way for non-transport failures", () => {
    const line = formatAgentEvent(
      {
        type: "llm_event",
        event: {
          type: "step_error",
          error: new Error("grammar rejected the completion"),
          category: "model" as never,
        },
      },
      { llamaHint: HINT, hintShown: { value: false } },
    );
    expect(line).toBe("  ! [model] grammar rejected the completion");
  });

  it("decorates loop_failed the same way", () => {
    const line = formatAgentEvent(
      {
        type: "loop_failed",
        error: new Error("fetch failed"),
        category: "transport" as never,
      },
      { llamaHint: HINT, hintShown: { value: false } },
    );
    expect(line).toContain("» loop failed [transport]: fetch failed");
    expect(line).toContain("llama-server is not reachable");
  });
});

describe("formatLlamaUnreachableHint", () => {
  it("names the URL, the start command and the config key", () => {
    const hint = formatLlamaUnreachableHint("http://10.0.0.4:9090");
    expect(hint).toContain("http://10.0.0.4:9090");
    expect(hint).toContain("h0x-cli models start");
    expect(hint).toContain("h0x-cli config set localModels.url <url>");
  });
});

/** Raw model output the stubbed llama-server replays on every step. */
const model = vi.hoisted(() => ({ emits: "" }));

// `runAgentCommand` boots the real runtime and takes no injection seam of
// its own, so the bootstrap module is wrapped to supply the same
// `overrides` the HTTP harness uses. Everything else — tool registry,
// agent loop, session status transitions, the exit-code branch under
// test — stays on the production path. Nothing may be imported from
// `../http/test-harness.js` in here: that module imports the very module
// being mocked, so awaiting it inside the factory re-enters the mock and
// deadlocks.
vi.mock("../runtime/bootstrap.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../runtime/bootstrap.js")>();
  const completion = (content: string): CompletionResult => ({
    content,
    reasoningContent: "",
    stop: true,
    truncated: false,
    timing: {
      promptMs: 0,
      predictedMs: 0,
      promptTokens: 5,
      predictedTokens: 3,
    },
    cacheHitTokens: 0,
    slotId: 0,
    modelId: null,
  });
  const complete = async (params: {
    sessionId: string;
  }): Promise<CompletionResult> => {
    // Post-turn reflection shares the completion seam but expects prose,
    // not a tool call; feeding it the step payload would have it parse
    // the fixture as notes.
    if (params.sessionId.startsWith("reflection:")) return completion("");
    return completion(model.emits);
  };
  return {
    ...actual,
    createAgentRuntime: (
      options: Parameters<typeof actual.createAgentRuntime>[0],
    ) =>
      actual.createAgentRuntime({
        ...options,
        // No browser override: `PlaywrightBackend` launches lazily and
        // these turns never touch a browser tool, so nothing spawns.
        overrides: {
          skipLlamaHealthCheck: true,
          disableStreaming: true,
          llamaComplete: complete,
        },
      }),
  };
});

const { runAgentCommand } = await import("./run-agent.js");

describe("runAgentCommand exit codes", () => {
  let stateDir: string;
  let workingDir: string;
  let stdout = "";
  let stderr = "";
  const realStdin = process.stdin;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), "atomic-cli-run-state-"));
    workingDir = mkdtempSync(join(tmpdir(), "atomic-cli-run-cwd-"));
    mkdirSync(join(workingDir, ".atomic-agent", "skills"), { recursive: true });
    writeFileSync(join(workingDir, "note.txt"), "hello\n", "utf8");
    process.env.ATOMIC_AGENT_STATE_DIR = stateDir;
    process.env.ATOMIC_AGENT_GRAMMARS_DIR = join(process.cwd(), "grammars");
    resetConfigCache();
    model.emits = "";
    stdout = "";
    stderr = "";
    vi.spyOn(process.stdout, "write").mockImplementation(((
      chunk: unknown,
      encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
      callback?: (error?: Error | null) => void,
    ) => {
      stdout += typeof chunk === "string" ? chunk : String(chunk);
      const done =
        typeof encodingOrCallback === "function" ? encodingOrCallback : callback;
      done?.();
      return true;
    }) as typeof process.stdout.write);
    vi.spyOn(process.stderr, "write").mockImplementation(((
      chunk: unknown,
      encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
      callback?: (error?: Error | null) => void,
    ) => {
      stderr += typeof chunk === "string" ? chunk : String(chunk);
      const done =
        typeof encodingOrCallback === "function" ? encodingOrCallback : callback;
      done?.();
      return true;
    }) as typeof process.stderr.write);
  });

  afterEach(() => {
    Object.defineProperty(process, "stdin", {
      value: realStdin,
      configurable: true,
    });
    rmSync(stateDir, { recursive: true, force: true });
    rmSync(workingDir, { recursive: true, force: true });
    delete process.env.ATOMIC_AGENT_STATE_DIR;
    delete process.env.ATOMIC_AGENT_GRAMMARS_DIR;
    delete process.env.H0X_CLI_EVAL_DISABLE_SESSION_SAVE;
    resetConfigCache();
    vi.restoreAllMocks();
  });

  function feedStdin(lines: string[]): void {
    const stdin = Readable.from(lines);
    Object.defineProperty(stdin, "isTTY", {
      value: false,
      configurable: true,
    });
    Object.defineProperty(process, "stdin", {
      value: stdin,
      configurable: true,
    });
  }

  it("exits 2 when --cwd points at a path that does not exist", async () => {
    const missing = join(workingDir, "definitely-not-here");
    const code = await runAgentCommand(["--cwd", missing]);
    expect(code).toBe(2);
    expect(stderr).toContain(`--cwd is not a directory: ${missing}`);
  });

  it("exits 2 when --working-dir points at a file rather than a directory", async () => {
    const file = join(workingDir, "note.txt");
    const code = await runAgentCommand(["--working-dir", file]);
    expect(code).toBe(2);
    expect(stderr).toContain(`--working-dir is not a directory: ${file}`);
  });

  it("exits 2 on an unknown flag", async () => {
    const code = await runAgentCommand(["--nope"]);
    expect(code).toBe(2);
    expect(stderr).toContain("unknown flag: --nope");
  });

  it(
    "exits 1 when the turn exhausts the step budget and the session stalls",
    async () => {
      // A non-terminal tool on every step: the loop never reaches `reply`
      // or `finish`, so it runs the budget out and lands on `stalled`.
      model.emits = JSON.stringify({
        tool: "os.fs.read",
        args: { path: "note.txt" },
      });
      feedStdin(["read the note\n"]);
      const code = await runAgentCommand([
        "--cwd",
        workingDir,
        "--max-steps",
        "2",
        "--no-approval",
      ]);
      expect(stderr).toContain('"status": "stalled"');
      expect(code).toBe(1);
    },
    60_000,
  );

  it(
    "consumes one-shot piped input without the interactive prompt",
    async () => {
      const questionSpy = vi.spyOn(ReadlineInterface.prototype, "question");
      model.emits = JSON.stringify({
        tool: "reply",
        args: { text: "the note says hello" },
      });
      feedStdin(["read the note\n"]);
      const code = await runAgentCommand([
        "--cwd",
        workingDir,
        "--max-steps",
        "2",
        "--no-approval",
      ]);
      expect(stdout).toBe("the note says hello\n");
      expect(stderr).toContain('"sessionId":');
      expect(stderr).toContain('"status": "pending"');
      expect(stderr).toContain('"turnCount": 1');
      expect(stderr).toContain('"stepCount": 1');
      expect(stderr).not.toContain('"status": "stalled"');
      expect(stderr).not.toContain("you> ");
      expect(questionSpy).not.toHaveBeenCalled();
      expect(code).toBe(0);
    },
    60_000,
  );

  it(
    "keeps real TTY input on the readline question prompt path",
    async () => {
      const stdin = Readable.from([]);
      Object.defineProperty(stdin, "isTTY", {
        value: true,
        configurable: true,
      });
      Object.defineProperty(process, "stdin", {
        value: stdin,
        configurable: true,
      });
      const questionSpy = vi
        .spyOn(ReadlineInterface.prototype, "question")
        .mockImplementation(function (
          this: ReadlineInterface,
          query: string,
          callback: (answer: string) => void,
        ): ReadlineInterface {
          process.stderr.write(query);
          callback("/quit");
          return this;
        });

      const code = await runAgentCommand([
        "--cwd",
        workingDir,
        "--max-steps",
        "2",
        "--no-approval",
      ]);

      expect(questionSpy).toHaveBeenCalledTimes(1);
      expect(questionSpy).toHaveBeenCalledWith("you> ", expect.any(Function));
      expect(stderr).toContain("you> ");
      expect(stderr).toContain('"turnCount": 0');
      expect(stdout).toBe("");
      expect(code).toBe(0);
    },
    60_000,
  );

  it(
    "can skip durable session persistence for eval one-shot runs",
    async () => {
      process.env.H0X_CLI_EVAL_DISABLE_SESSION_SAVE = "1";
      model.emits = JSON.stringify({
        tool: "reply",
        args: { text: "saved only to trace" },
      });
      feedStdin(["answer once\n"]);

      const code = await runAgentCommand([
        "--cwd",
        workingDir,
        "--max-steps",
        "2",
        "--no-approval",
      ]);

      const sessionId = /"sessionId": "([^"]+)"/.exec(stderr)?.[1];
      expect(sessionId).toEqual(expect.any(String));
      expect(stdout).toBe("saved only to trace\n");
      expect(code).toBe(0);

      const store = new SessionStore({ dbFile: join(stateDir, "sessions.sqlite") });
      try {
        expect(store.load(sessionId ?? "")).toBeNull();
      } finally {
        store.close();
      }
    },
    60_000,
  );
});
