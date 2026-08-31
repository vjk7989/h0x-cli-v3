import { render } from "ink-testing-library";
import chalk from "chalk";
import { describe, expect, it, vi } from "vitest";
import { toSlashCommands } from "../menu/menu-registry.js";
import { LOGO_ART } from "./logo.js";
import { SplashBanner, type SplashBannerProps } from "./splash-banner.js";

vi.mock("../../version.js", () => ({ getAppVersion: () => "0.4.2-test" }));

function strip(value: string): string {
  return value
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\u001b\]8;;[^\u0007]*\u0007/g, "");
}

function frameAt(columns: number, rows: number, props: SplashBannerProps = {}): string {
  const view = render(<SplashBanner {...props} size={{ columns, rows }} />);
  const frame = strip(view.lastFrame() ?? "");
  view.unmount();
  return frame;
}

describe("SplashBanner", () => {
  it.each([96, 51, 50, 24])("keeps one bold identity row below art or as fallback at %s columns", (columns) => {
    const level = chalk.level;
    chalk.level = 3;
    const view = render(<SplashBanner size={{ columns, rows: 40 }} model="local" workingDir="G:/work" />);
    try {
      const rows = (view.lastFrame() ?? "").split("\n");
      const identity = rows.filter((row) => strip(row).includes("h0x-cli"));
      expect(identity).toHaveLength(1);
      expect(identity[0]).toContain("\u001b[1m");
      const art = rows.filter((row) => strip(row).includes("\u28ff"));
      expect(art).toHaveLength(columns >= 51 ? 7 : 0);
      if (art.length) expect(rows.indexOf(identity[0]!)).toBeGreaterThan(rows.indexOf(art.at(-1)!));
    } finally {
      view.unmount();
      chalk.level = level;
    }
  });

  it.each([undefined, null, "", "   "])("labels an unconfigured model explicitly (%s)", (model) => {
    expect(frameAt(96, 40, { model })).toContain("model: not configured");
  });

  it("renders the complete wordmark and ordered session metadata", () => {
    const frame = frameAt(96, 40, {
      model: "qwen-local", workingDir: "G:/work/sample", git: { name: "sample", branch: "feature/rebrand" },
    });
    for (const row of LOGO_ART.full) expect(frame).toContain(row.trimEnd());
    const fields = ["h0x-cli v0.4.2-test", "qwen-local", "G:/work/sample", "feature/rebrand", "Built by TEAM PAVii.Ai", "https://pavii.tech"];
    let previous = -1;
    for (const field of fields) {
      const position = frame.indexOf(field);
      expect(position, field).toBeGreaterThan(previous);
      previous = position;
    }
    expect(frame).toMatch(/docs/i);
    expect(frame).not.toContain("Local AI-First Agent");
  });

  it("omits repository information when there is no Git context", () => {
    const frame = frameAt(96, 40, { model: null, workingDir: "G:/work/plain", git: null });
    expect(frame).toContain("h0x-cli v0.4.2-test");
    expect(frame).toContain("G:/work/plain");
    expect(frame).not.toMatch(/\b(repo|branch)\s*:/i);
    expect(frame).not.toContain("undefined");
    expect(frame).not.toContain("null");
  });

  it("advertises all six core slash commands when there is room", () => {
    const frame = frameAt(96, 40);
    for (const command of ["/help", "/sessions", "/new", "/model", "/tasks", "/import"]) {
      expect(frame).toContain(command);
    }
    expect(frame).not.toContain("Ctrl+C");
  });

  it("swaps in terse descriptions on a narrow surface", () => {
    const frame = frameAt(38, 30);
    expect(frame).toContain("/help");
    expect(frame).toContain("all commands");
    expect(frame).not.toContain("list all slash commands");
  });

  it.each([2, 4, 5, 8])("keeps the plain brand on a %s-row surface", (rows) => {
    const frame = frameAt(38, rows, { model: "local-model", workingDir: "G:/work" });
    expect(frame).toContain("h0x-cli");
    expect(frame.split("\n").length).toBeLessThanOrEqual(rows);
  });

  it("keeps title and model ahead of lower-priority info on a short surface", () => {
    const frame = frameAt(60, 4, { model: "local-model", workingDir: "G:/work" });
    expect(frame).toContain("h0x-cli");
    expect(frame).toContain("local-model");
    expect(frame).not.toContain("https://pavii.tech");
    expect(frame).not.toContain("/import");
  });

  it("measures the terminal itself when no size is given", () => {
    const view = render(<SplashBanner />);
    expect(strip(view.lastFrame() ?? "")).toContain("h0x-cli");
    view.unmount();
  });

  it("only advertises slash commands that exist in the menu registry", () => {
    const frame = frameAt(96, 40);
    const registered = new Set(toSlashCommands().flatMap((c) => [c.name, ...(c.aliases ?? [])]));
    // Anchor at the tip prefix so URLs and paths are not mistaken for commands.
    const advertised = [...frame.matchAll(/^\s*[^\w\s/]\s+\/([a-z][a-z0-9-]*)/gm)].map((m) => m[1]!);
    expect(advertised).toHaveLength(6);
    for (const name of advertised) expect(registered).toContain(name);
  });
});
