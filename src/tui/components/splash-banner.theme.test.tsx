import chalk from "chalk";
import { describe, expect, it, vi } from "vitest";
import { renderAtSize } from "../test-sized-render.js";
import { getActiveTheme, setActiveTheme, THEMES, THEME_NAMES } from "../theme/theme.js";
import { parseHexColor } from "../theme/parse-hex-color.js";
import { LOGO_ART } from "./logo.js";
import { SplashBanner } from "./splash-banner.js";

const strip = (frame: string): string => frame.replace(/\u001b\[[0-9;]*m/g, "");
const rows = (frame: string): string[] => strip(frame).split("\n").map((row) => row.replace(/ +$/, ""));

describe("SplashBanner terminal colour modes", () => {
  it.each(THEME_NAMES)("preserves content and layout in %s with colour disabled", (name) => {
    const previousTheme = getActiveTheme();
    const previousLevel = chalk.level;
    const size = { columns: 96, rows: 40 };
    const capture = (): string => {
      const view = renderAtSize(
        <SplashBanner size={size} model="local.gguf" workingDir="G:/work"
          git={{ name: "work", branch: "main" }} />,
        size,
      );
      try { return view.lastFrame() ?? ""; } finally { view.unmount(); }
    };
    try {
      setActiveTheme(THEMES[name]);
      const rgb = parseHexColor(THEMES[name].colors.accent);
      if (!rgb) throw new Error("Invalid accent colour");
      const accent = "\u001b[38;2;" + rgb.r + ";" + rgb.g + ";" + rgb.b + "m";
      chalk.level = 3;
      const coloured = capture();
      const title = coloured.split("\n").find((row) => strip(row).includes("h0x-cli"));
      expect(title).toContain(accent);
      const art = coloured.split("\n").filter((row) => strip(row).includes("\u28ff"));
      expect(art).toHaveLength(7);
      for (const row of art) expect(row).toContain(accent);
      vi.stubEnv("NO_COLOR", "1");
      // Chalk caches terminal capability at import time; model the disabled capability explicitly.
      chalk.level = 0;
      const plain = capture();
      expect(plain).not.toMatch(/\u001b\[[0-9;]*m/);
      expect(rows(plain)).toEqual(rows(coloured));
      for (const row of LOGO_ART.full) expect(plain).toContain(row.trimEnd());
      for (const text of ["h0x-cli", "local.gguf", "G:/work", "main", "Built by TEAM PAVii.Ai",
        "https://pavii.tech", "docs (placeholder)", "/help", "/sessions", "/new", "/model", "/tasks", "/import"]) {
        expect(plain).toContain(text);
      }
    } finally {
      chalk.level = previousLevel;
      setActiveTheme(previousTheme);
      vi.unstubAllEnvs();
    }
  });
});
