import chalk from "chalk";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { renderAtSize } from "../test-sized-render.js";
import { fakeSession } from "../test-fixtures.js";
import { createInitialTuiState } from "../tui-state.js";
import { parseHexColor } from "../theme/parse-hex-color.js";
import { getActiveTheme, setActiveTheme, THEMES, THEME_NAMES } from "../theme/theme.js";
import { HotkeyHint } from "./hotkey-hint.js";
import { Sidebar } from "./sidebar.js";
import { ThemePicker } from "./theme-picker.js";

const strip = (frame: string): string => frame.replace(/\u001b\[[0-9;]*m/g, "");

function foreground(hex: string): string {
  const rgb = parseHexColor(hex);
  if (!rgb) throw new Error("Invalid colour: " + hex);
  return "\u001b[38;2;" + rgb.r + ";" + rgb.g + ";" + rgb.b + "m";
}

function capture(tree: ReactElement): string {
  const view = renderAtSize(tree, { columns: 100, rows: 40 });
  try { return view.lastFrame() ?? ""; } finally { view.unmount(); }
}

describe("readable branding controls", () => {
  it.each(THEME_NAMES)("uses text-safe accent roles in %s", (name) => {
    const previous = getActiveTheme();
    const level = chalk.level;
    try {
      setActiveTheme(THEMES[name]);
      chalk.level = 3;
      const colors = THEMES[name].colors;
      const sidebar = capture(<Sidebar width={32} sessions={[]} sessionsCursor={0}
        currentSessionId={null} tasks={[]} tasksCursor={0} activeSection="sessions" focused={false} />);
      const title = sidebar.split("\n").find((row) => strip(row).includes("h0x-cli"));
      expect(title).toContain(foreground(colors.railAccent));
      expect(sidebar).toContain(foreground(colors.railBackground).replace("[38;", "[48;"));

      const picker = capture(<ThemePicker cursor={THEME_NAMES.indexOf(name)} original={name} />);
      const selected = picker.split("\n").find((row) => strip(row).includes(name));
      expect(selected).toBeDefined();
      const label = selected!.slice(0, selected!.indexOf(name));
      expect(label).toContain(foreground(colors.accent));
      expect(label).not.toContain(foreground(colors.accentSoft));

      const hint = capture(<HotkeyHint state={createInitialTuiState(fakeSession())} width={96} />);
      expect(strip(hint)).toMatch(/\[[^\]]+\]/);
      expect(hint).toContain(foreground(colors.accent));
      expect(hint).not.toContain(foreground(colors.accentSoft));
    } finally {
      chalk.level = level;
      setActiveTheme(previous);
    }
  });
});
