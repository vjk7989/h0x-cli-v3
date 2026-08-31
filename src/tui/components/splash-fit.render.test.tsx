import { Box } from "ink";
import stringWidth from "string-width";
import { describe, expect, it, vi } from "vitest";
import { computeChatViewportRows, computeChatWidth } from "../layout.js";
import { renderAtSize } from "../test-sized-render.js";
import { SplashBanner } from "./splash-banner.js";
import { LOGO_ART } from "./logo.js";

function lines(frame: string): string[] {
  return frame
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\u001b\]8;;[^\u0007]*\u0007/g, "")
    .trimEnd().split("\n").map((line) => line.trimEnd());
}

const TERMINALS = [
  { columns: 40, rows: 12 },
  { columns: 60, rows: 20 },
  { columns: 80, rows: 24 },
  { columns: 100, rows: 30 },
  { columns: 100, rows: 50 },
  { columns: 160, rows: 60 },
];

describe("SplashBanner fit", () => {
  it.each([24, 40, 60, 96])("bounds fullwidth and combining metadata by display cells at %s columns", (columns) => {
    const size = { columns, rows: 40 };
    const directory = "G:/\u5168\u89d2/cafe\u0301/".repeat(12);
    const branch = "feature/\u5168\u89d2/e\u0301".repeat(12);
    const view = renderAtSize(
      <SplashBanner size={size} model="local.gguf" workingDir={directory}
        git={{ name: "\u5168\u89d2-cafe\u0301", branch }} />,
      size,
    );
    try {
      const rendered = lines(view.lastFrame() ?? "");
      expect(rendered.join("\n")).toContain("h0x-cli");
      expect(rendered.length).toBeLessThanOrEqual(size.rows);
      for (const row of rendered) expect(stringWidth(row)).toBeLessThanOrEqual(columns);
      const directoryRow = rendered.find((row) => row.includes("directory:"));
      const gitRow = rendered.find((row) => row.includes("git:"));
      expect(directoryRow).toBeDefined();
      expect(gitRow).toBeDefined();
      expect(rendered.join("\n")).toContain("\u5168\u89d2");
      expect(rendered.join("\n")).not.toContain("\ufffd");
    } finally {
      view.unmount();
    }
  });

  it("reflows from full artwork to compact metadata and back on resize", async () => {
    const roomy = { columns: 96, rows: 40 };
    const compact = { columns: 24, rows: 4 };
    const banner = (size: typeof roomy) => (
      <SplashBanner size={size} model="local" workingDir="G:/work" />
    );
    const view = renderAtSize(banner(roomy), roomy);
    try {
      const original = lines(view.lastFrame() ?? "").join("\n");
      expect(original).toContain(LOGO_ART.full[0]!.trimEnd());
      expect(original).toContain("/import");
      view.rerender(banner(compact));
      await vi.waitFor(() => {
        const frame = lines(view.lastFrame() ?? "");
        expect(frame.length).toBeLessThanOrEqual(compact.rows);
        expect(frame.join("\n")).toContain("model: local");
        expect(frame.join("\n")).not.toContain("/import");
        for (const row of frame) expect(stringWidth(row)).toBeLessThanOrEqual(compact.columns);
      });
      view.rerender(banner(roomy));
      await vi.waitFor(() => expect(lines(view.lastFrame() ?? "").join("\n")).toBe(original));
    } finally {
      view.unmount();
    }
  });

  for (const git of [null, { name: "repo with a long name", branch: "feature/a-very-long-branch-name" }]) {
    it.each(TERMINALS)("fits a $columns x $rows terminal with git=" + Boolean(git), (terminal) => {
      const size = {
        columns: computeChatWidth(terminal.columns, terminal.rows),
        rows: computeChatViewportRows(terminal.rows, terminal.columns),
      };
      const view = renderAtSize(
        <Box width={size.columns}>
          <SplashBanner size={size} model={"provider/" + "long-model-name-".repeat(12)}
            workingDir={"G:/work/" + "nested directory/".repeat(12)} git={git} />
        </Box>,
        terminal,
      );
      const rendered = lines(view.lastFrame() ?? "");
      expect(Math.max(...rendered.map((line) => line.length))).toBeLessThanOrEqual(size.columns);
      expect(rendered.length).toBeLessThanOrEqual(size.rows);
      if (size.rows >= 2 && size.columns >= 24) expect(rendered.join("\n")).toContain("h0x-cli");
      view.unmount();
    });
  }

  it.each([2, 4, 5, 8, 10])("fits compact metadata in %s rows without requiring tips", (rows) => {
    const size = { columns: 24, rows };
    const view = renderAtSize(<SplashBanner size={size} model="local" workingDir="G:/work" />, size);
    const frame = lines(view.lastFrame() ?? "");
    expect(frame.length).toBeLessThanOrEqual(rows);
    expect(Math.max(...frame.map((line) => line.length))).toBeLessThanOrEqual(24);
    expect(frame.join("\n")).toContain("h0x-cli");
    view.unmount();
  });

  it("keeps the full brand, metadata and all tips on a roomy surface", () => {
    const size = { columns: 96, rows: 40 };
    const view = renderAtSize(
      <SplashBanner size={size} model="local" workingDir="G:/work" git={{ name: "work", branch: "main" }} />,
      size,
    );
    const frame = lines(view.lastFrame() ?? "").join("\n");
    for (const text of ["h0x-cli", "local", "G:/work", "main", "Built by TEAM PAVii.Ai", "https://pavii.tech", "docs"]) {
      expect(frame).toContain(text);
    }
    for (const command of ["/help", "/sessions", "/new", "/model", "/tasks", "/import"]) {
      expect(frame).toContain(command);
    }
    expect(lines(frame).length).toBeLessThanOrEqual(size.rows);
    view.unmount();
  });

  it("does not let metadata control characters add rows or terminal commands", () => {
    const size = { columns: 60, rows: 20 };
    const view = renderAtSize(
      <SplashBanner size={size} model={"model\ninjected"}
        workingDir={"G:/work\rnext"} git={{ name: "repo\tname", branch: "main\u001b[2J" }} />,
      size,
    );
    const frame = lines(view.lastFrame() ?? "").join("\n");
    expect(frame).toContain("modelinjected");
    expect(frame).toContain("G:/worknext");
    expect(frame).not.toContain("\u001b[2J");
    expect(lines(frame).length).toBeLessThanOrEqual(size.rows);
    view.unmount();
  });
});
