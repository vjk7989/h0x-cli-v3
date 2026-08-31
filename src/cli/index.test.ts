import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cli = vi.hoisted(() => ({
  argv: [] as string[],
  exit: vi.fn(),
  tui: vi.fn(),
  otherCommand: vi.fn(),
}));

// Import the real dispatcher without starting a runtime or exiting the worker.
vi.mock("node:sea", () => ({ isSea: () => false }));
vi.mock("node:process", () => ({ argv: cli.argv, exit: cli.exit }));
vi.mock("../version.js", () => ({ getAppVersion: () => "0.4.2-test" }));
vi.mock("../tui/index.js", () => ({ tuiCommand: cli.tui }));
vi.mock("./run-agent.js", () => ({ runAgentCommand: cli.otherCommand }));
vi.mock("./debug-repl.js", () => ({ debugReplCommand: cli.otherCommand }));
vi.mock("./skill.js", () => ({ skillCommand: cli.otherCommand }));
vi.mock("./config-command.js", () => ({ configCommand: cli.otherCommand }));
vi.mock("./serve-command.js", () => ({ serveCommand: cli.otherCommand }));
vi.mock("./trace-command.js", () => ({ traceCommand: cli.otherCommand }));
vi.mock("./task-command.js", () => ({ taskCommand: cli.otherCommand }));
vi.mock("./models-command.js", () => ({ modelsCommand: cli.otherCommand }));
vi.mock("./import-command.js", () => ({ importCommand: cli.otherCommand }));
vi.mock("./uninstall-command.js", () => ({ uninstallCommand: cli.otherCommand }));
vi.mock("./update-command.js", () => ({ updateCommand: cli.otherCommand }));

let stdout: string[];
let stderr: string[];

beforeEach(() => {
  vi.resetModules();
  cli.exit.mockReset();
  cli.tui.mockReset().mockResolvedValue(0);
  cli.otherCommand.mockReset().mockResolvedValue(0);
  stdout = [];
  stderr = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    stdout.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    stderr.push(String(chunk));
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

async function invoke(args: string[], name = "h0x-cli"): Promise<number> {
  cli.argv.splice(0, cli.argv.length, process.execPath, name, ...args);
  const exited = new Promise<number>((resolve) => {
    cli.exit.mockImplementation((code: number) => resolve(code));
  });
  await import("./index.js");
  return exited;
}

describe("CLI entry", () => {
  it.each(["--help", "-h", "help"])("%s identifies the product and retains alias usage", async (flag) => {
    expect(await invoke([flag])).toBe(0);
    const output = stdout.join("");
    expect(output).toContain("h0x - CLI");
    expect(output).toContain("h0x-cli <command> [options]");
    expect(output).toContain("atomic-agent <command> [options]");
    expect(output).toContain("atag <command> [options]");
    expect(cli.tui).not.toHaveBeenCalled();
    expect(cli.otherCommand).not.toHaveBeenCalled();
    expect(stderr).toEqual([]);
  });

  it.each(["--version", "-v", "version"])("%s emits the canonical command and version", async (flag) => {
    expect(await invoke([flag])).toBe(0);
    expect(stdout.join("")).toBe("h0x-cli 0.4.2-test\n");
    expect(cli.tui).not.toHaveBeenCalled();
    expect(cli.otherCommand).not.toHaveBeenCalled();
    expect(stderr).toEqual([]);
  });

  it.each(["h0x-cli", "atomic-agent", "atag"])("%s without arguments opens the same TUI in the caller's cwd", async (name) => {
    const cwd = process.cwd();
    const chdir = vi.spyOn(process, "chdir").mockImplementation(() => {
      throw new Error("CLI dispatch must not change the current directory");
    });
    cli.tui.mockImplementation(async () => {
      expect(process.cwd()).toBe(cwd);
      return 19;
    });
    expect(await invoke([], name)).toBe(19);
    expect(cli.tui).toHaveBeenCalledTimes(1);
    expect(cli.tui).toHaveBeenCalledWith([]);
    expect(cli.otherCommand).not.toHaveBeenCalled();
    expect(chdir).not.toHaveBeenCalled();
    expect(stdout).toEqual([]);
    expect(stderr).toEqual([]);
  });

  it("explicit tui uses the same handler and forwards its exit code", async () => {
    cli.tui.mockResolvedValue(19);
    expect(await invoke(["tui"])).toBe(19);
    expect(cli.tui).toHaveBeenCalledTimes(1);
    expect(cli.tui).toHaveBeenCalledWith([]);
    expect(cli.otherCommand).not.toHaveBeenCalled();
  });
});
