import { afterEach, describe, expect, it } from "vitest";
import {
  THEMES,
  THEME_NAMES,
  getActiveTheme,
  getActiveThemeName,
  isRetiredThemeName,
  isThemeName,
  resolveThemeName,
  setActiveTheme,
  theme,
  type TuiColors,
} from "./theme.js";

const COLOR_KEYS: (keyof TuiColors)[] = [
  "user",
  "assistant",
  "system",
  "reasoning",
  "tool",
  "toolOk",
  "toolError",
  "accent",
  "accentSoft",
  "border",
  "muted",
  "error",
  "warn",
  "warnStrong",
  "success",
  "info",
];

describe("theme proxy", () => {
  afterEach(() => {
    // Restore the module default so test order does not leak.
    setActiveTheme(THEMES["classic-dark"]);
  });

  it("forwards reads to the active theme and updates after a swap", () => {
    setActiveTheme(THEMES["classic-dark"]);
    expect(theme.colors.accent).toBe(THEMES["classic-dark"].colors.accent);

    setActiveTheme(THEMES["classic-light"]);
    expect(theme.colors.accent).toBe(THEMES["classic-light"].colors.accent);
    expect(theme.colors.accent).toBe("#6b35b5");
  });

  it("reflects swaps for glyphs and spinner too (shared, but proxied)", () => {
    setActiveTheme(THEMES["classic-light"]);
    expect(theme.glyphs.promptCaret).toBe("❯");
    expect(theme.spinnerFrames.length).toBeGreaterThan(0);
  });

  it("getActiveTheme returns the current backing object", () => {
    setActiveTheme(THEMES["classic-dark"]);
    expect(getActiveTheme()).toBe(THEMES["classic-dark"]);
  });

  it("every registered theme defines all 16 colour keys", () => {
    for (const named of Object.values(THEMES)) {
      for (const key of COLOR_KEYS) {
        expect(typeof named.colors[key]).toBe("string");
        expect(named.colors[key].length).toBeGreaterThan(0);
      }
    }
  });

  it("THEME_NAMES lists exactly the registered theme keys", () => {
    expect([...THEME_NAMES].sort()).toEqual(Object.keys(THEMES).sort());
  });

  it("isThemeName accepts registered names and rejects others", () => {
    expect(isThemeName("classic-dark")).toBe(true);
    expect(isThemeName("khorne-red")).toBe(true);
    expect(isThemeName("not-a-theme")).toBe(false);
    expect(isThemeName("")).toBe(false);
    // A retired name is *not* a registered one. `resolveThemeName` is
    // what rehomes it; the guard has to keep saying no, or a stale name
    // would reach `THEMES[name]` and index nothing.
    expect(isThemeName("dracula")).toBe(false);
  });

  it("rehomes every retired theme name to a registered palette", () => {
    const retired = [
      "atomic-retro",
      "github-dark",
      "github-light",
      "catppuccin-mocha",
      "catppuccin-latte",
      "dracula",
      "nord",
      "tokyo-night",
      "gruvbox-dark",
      "gruvbox-light",
      "solarized-dark",
      "solarized-light",
    ];
    for (const name of retired) {
      const resolved = resolveThemeName(name);
      expect(resolved, `${name} has no home`).not.toBeNull();
      expect(isThemeName(resolved as string)).toBe(true);
      expect(isRetiredThemeName(name)).toBe(true);
    }
    // Retired configuration names still resolve to the house palette.
    expect(resolveThemeName("atomic-retro")).toBe("classic-dark");
    // Anything that was never a theme still falls through to autodetect.
    expect(resolveThemeName("not-a-theme")).toBeNull();
    expect(isRetiredThemeName("not-a-theme")).toBe(false);
    expect(isRetiredThemeName("classic-dark")).toBe(false);
  });

  it("getActiveThemeName reverse-maps the active backing object", () => {
    setActiveTheme(THEMES["toxic-green"]);
    expect(getActiveThemeName()).toBe("toxic-green");
    setActiveTheme(THEMES["moon-yellow"]);
    expect(getActiveThemeName()).toBe("moon-yellow");
  });

  it("uses the approved purple page and rail tokens in the classic palettes", () => {
    expect(THEMES["classic-dark"].colors).toMatchObject({
      user: "#b084f5", accent: "#b084f5", info: "#b084f5", brandMark: "#b084f5",
      accentSoft: "#4b2870", railBackground: "#382052", railMuted: "#cbb8e5",
      railAccent: "#d8baff", badgeBackground: "#1d1828",
    });
    expect(THEMES["classic-light"].colors).toMatchObject({
      user: "#6b35b5", accent: "#6b35b5", info: "#6b35b5", brandMark: "#6b35b5",
      accentSoft: "#cbb7e5", railBackground: "#ede7f3", railAccent: "#6b35b5",
      badgeBackground: "#e6dcf2",
    });
  });

  it.each(THEME_NAMES)("keeps the wordmark on %s's own accent", (name) => {
    setActiveTheme(THEMES[name]);
    expect(theme.colors.brandMark).toBe(theme.colors.accent);
  });

  it.each([
    ["classic-dark", "#eb6264", "#e6d35c", "#5edb81"],
    ["classic-light", "#c1121f", "#7a5300", "#136c33"],
    ["toxic-green", "#ff6b6b", "#f7e05c", "#9df871"],
    ["khorne-red", "#ff7a5c", "#e8c15a", "#d9a441"],
    ["darky-dark", "#d98a8a", "#cfc08a", "#b9c9b4"],
    ["moon-yellow", "#e78b8b", "#e6b962", "#a9d6a4"],
  ] as const)("preserves semantic status inks in %s", (name, error, warn, success) => {
    expect(THEMES[name].colors).toMatchObject({ error, warn, success });
  });
});
