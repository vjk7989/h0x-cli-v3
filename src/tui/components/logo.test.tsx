import { render } from "ink-testing-library";
import chalk from "chalk";
import { describe, expect, it } from "vitest";
import { LOGO_ART, Logo } from "./logo.js";
import { contrastRatio } from "../theme/color-contrast.js";
import { CANONICAL_PAGE } from "../theme/theme-palettes.js";
import { THEMES, THEME_NAMES } from "../theme/theme.js";

function strip(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function artworkRows(frame: string): string[] {
  const rows = strip(frame).split("\n");
  const indents = rows.filter((row) => row.trim().length > 0)
    .map((row) => row.match(/^ */)![0].length);
  const padding = indents.length > 0 ? Math.min(...indents) : 0;
  // Remove only shared layout padding; relative indentation is part of the art.
  return rows.map((row) => row.slice(padding).trimEnd());
}

describe("Logo", () => {
  it.each(["full", "small", "mini", "tiny"] as const)("%s emphasizes artwork and its single plain identity", (variant) => {
    const level = chalk.level;
    chalk.level = 3;
    const view = render(<Logo variant={variant} tagline={false} />);
    try {
      const frame = view.lastFrame() ?? "";
      const rows = frame.split("\n");
      const identity = rows.filter((row) => strip(row).includes("h0x-cli"));
      expect(identity).toHaveLength(1);
      expect(identity[0]).toContain("\u001b[1m");
      const art = rows.filter((row) => strip(row).includes("\u28ff"));
      expect(art).toHaveLength(variant === "full" || variant === "small" ? 7 : 0);
      for (const row of art) expect(row).toContain("\u001b[1m");
      if (art.length) expect(rows.indexOf(identity[0]!)).toBeGreaterThan(rows.indexOf(art.at(-1)!));
    } finally {
      view.unmount();
      chalk.level = level;
    }
  });

  it.each(["full", "small", "mini", "tiny"] as const)("%s renders as one complete wordmark", (variant) => {
    const view = render(<Logo variant={variant} wordmark={false} tagline={false} />);
    const lines = artworkRows(view.lastFrame() ?? "");
    expect(lines).toEqual(LOGO_ART[variant].map((row) => row.trimEnd()));
    view.unmount();
  });

  it("defaults to full artwork with the product name and attribution", () => {
    const view = render(<Logo />);
    const frame = strip(view.lastFrame() ?? "");
    for (const row of LOGO_ART.full) expect(frame).toContain(row.trimEnd());
    expect(frame).toContain("h0x-cli");
    expect(frame).toContain("Built by TEAM PAVii.Ai");
    expect(frame).not.toContain("Local AI-First Agent");
    view.unmount();
  });

  it("keeps the wordmark itself in legacy compact mode", () => {
    const view = render(<Logo compact />);
    expect(artworkRows(view.lastFrame() ?? ""))
      .toEqual(LOGO_ART.full.map((row) => row.trimEnd()));
    view.unmount();
  });

  it.each(THEME_NAMES)("keeps the brand and metadata readable in %s", (name) => {
    const colors = THEMES[name].colors;
    for (const foreground of [colors.brandMark, colors.muted]) {
      expect(contrastRatio(foreground, CANONICAL_PAGE[name])).toBeGreaterThanOrEqual(4.5);
    }
  });
});
