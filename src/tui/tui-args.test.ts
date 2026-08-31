import { describe, expect, it } from "vitest";

import { nonInteractiveStdinError, parseTuiArgs, TUI_HELP } from "./tui-args.js";

describe("nonInteractiveStdinError", () => {
  it.each([false, undefined])("refuses stdin with isTTY=%s with an actionable sentence", (isTTY) => {
    const message = nonInteractiveStdinError({ isTTY });
    expect(message).toContain("needs an interactive terminal");
    expect(message).toContain("h0x-cli run");
  });

  it("stays silent on a real terminal", () => {
    expect(nonInteractiveStdinError({ isTTY: true })).toBeNull();
  });

  it("defaults to the real process.stdin", () => {
    // Vitest workers run with piped stdio, so the default argument is the
    // non-TTY case — the exact environment the guard exists for.
    expect(nonInteractiveStdinError()).not.toBeNull();
  });
});

describe("parseTuiArgs", () => {
  it("uses the caller's current directory when no arguments are given", () => {
    expect(parseTuiArgs([])).toMatchObject({ workingDir: process.cwd() });
  });

  it("still reports unknown flags as usage errors", () => {
    expect(parseTuiArgs(["--definitely-not-a-flag"])).toHaveProperty("error");
  });
});

describe("parseTuiArgs mouse flags", () => {
  it("defers to the config by default", () => {
    const parsed = parseTuiArgs([]);
    expect(parsed).toMatchObject({ mouse: null });
  });

  it("--no-mouse turns reporting off for the run", () => {
    expect(parseTuiArgs(["--no-mouse"])).toMatchObject({ mouse: false });
  });

  it("--mouse forces reporting on even when the config disabled it", () => {
    expect(parseTuiArgs(["--mouse"])).toMatchObject({ mouse: true });
  });

  it("advertises both flags in --help", () => {
    expect(TUI_HELP).toContain("--no-mouse");
    expect(TUI_HELP).toContain("--mouse");
  });
});
