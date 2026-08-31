import { describe, expect, it } from "vitest";
import {
  computeSplashFit,
  LOGO_METRICS,
  SPLASH_TIPS,
  type LogoVariant,
} from "./splash-fit.js";

const SIZE_ORDER: readonly LogoVariant[] = ["tiny", "mini", "small", "full"];

describe("computeSplashFit", () => {
  it("gives a roomy surface the full wordmark, metadata and all six tips", () => {
    expect(SPLASH_TIPS).toHaveLength(6);
    expect(computeSplashFit({ columns: 108, rows: 44 })).toMatchObject({
      logo: "full",
      infoRows: 6,
      wordmarkPlacement: "none",
      wordmark: false,
      tagline: false,
      tipCount: 6,
      descriptions: "full",
    });
  });

  it("reserves the optional repository row", () => {
    const size = { columns: 96, rows: 40 };
    expect(computeSplashFit(size).infoRows).toBe(6);
    expect(computeSplashFit(size, 7)).toMatchObject({ infoRows: 7, tipCount: 6 });
  });

  it.each([6, 7])("prioritizes metadata on short surfaces with %s requested rows", (metadataRows) => {
    for (let rows = 2; rows <= 8; rows += 1) {
      const fit = computeSplashFit({ columns: 96, rows }, metadataRows);
      expect(fit.infoRows).toBeGreaterThan(0);
      if (fit.infoRows < metadataRows) expect(fit.tipCount).toBe(0);
      expect(fit.infoRows).toBeLessThanOrEqual(rows);
    }
  });

  it("steps down artwork when its width does not fit", () => {
    expect(computeSplashFit({ columns: 96, rows: 40 }).logo).toBe("full");
    expect(computeSplashFit({ columns: 60, rows: 40 }).logo).toBe("small");
    expect(computeSplashFit({ columns: 24, rows: 40 }).logo).toBe("none");
    expect(computeSplashFit({ columns: 12, rows: 40 }).logo).toBe("none");
  });

  it.each([
    [86, "full"], [85, "small"], [51, "small"], [50, "none"],
  ] as const)("selects the complete wordmark at the %s-column boundary", (columns, logo) => {
    expect(computeSplashFit({ columns, rows: 40 }).logo).toBe(logo);
  });

  it.each([6, 7])("needs seven art rows plus gap, metadata and slack (%s info rows)", (metadataRows) => {
    const rows = 7 + 1 + metadataRows + 1;
    expect(computeSplashFit({ columns: 86, rows }, metadataRows).logo).toBe("full");
    expect(computeSplashFit({ columns: 51, rows }, metadataRows).logo).toBe("small");
    expect(computeSplashFit({ columns: 86, rows: rows - 1 }, metadataRows).logo).toBe("none");
  });

  it("uses terse descriptions on narrow surfaces and bare labels below that", () => {
    expect(computeSplashFit({ columns: 38, rows: 40 }).descriptions).toBe("short");
    expect(computeSplashFit({ columns: 20, rows: 40 })).toMatchObject({
      descriptions: "none", labelWidth: 0,
    });
  });

  it("pads labels only to the longest visible command plus one space", () => {
    const fit = computeSplashFit({ columns: 108, rows: 44 });
    expect(fit.labelWidth).toBe(Math.max(...SPLASH_TIPS.map((tip) => tip.label.length)) + 1);
  });

  it("survives a degenerate surface without allocating content rows", () => {
    expect(computeSplashFit({ columns: 0, rows: 0 })).toMatchObject({
      logo: "none", infoRows: 0, tipCount: 0, labelWidth: 0,
    });
  });

  it.each([6, 7])("fits the surface including %s metadata rows and spacing", (metadataRows) => {
    for (let columns = 10; columns <= 200; columns += 3) {
      for (let rows = 2; rows <= 60; rows += 3) {
        const fit = computeSplashFit({ columns, rows }, metadataRows);
        const markHeight = fit.logo === "none" ? 0 : LOGO_METRICS[fit.logo].height;
        const groups = [markHeight, fit.infoRows, fit.tipCount].filter((n) => n > 0);
        const height = groups.reduce((sum, n) => sum + n, 0) + Math.max(0, groups.length - 1);
        expect(height).toBeLessThanOrEqual(rows - 1);
        expect(fit.infoRows).toBeGreaterThanOrEqual(0);
        expect(fit.infoRows).toBeLessThanOrEqual(metadataRows);
        expect(fit.tipCount).toBeGreaterThanOrEqual(0);
        expect(fit.tipCount).toBeLessThanOrEqual(6);
        expect(fit.labelWidth).toBeGreaterThanOrEqual(0);
        expect(fit).toMatchObject({ wordmarkPlacement: "none", wordmark: false, tagline: false });
        if (fit.logo !== "none") {
          expect(LOGO_METRICS[fit.logo].width).toBeLessThanOrEqual(columns - 4);
        }
      }
    }
  });

  it("never shrinks the mark as the terminal gets wider", () => {
    let previous = -1;
    for (let columns = 10; columns <= 200; columns += 1) {
      const choice = computeSplashFit({ columns, rows: 60 }).logo;
      const rank = choice === "none" ? -1 : SIZE_ORDER.indexOf(choice);
      expect(rank).toBeGreaterThanOrEqual(previous);
      previous = rank;
    }
  });

  it("never loses metadata as the surface grows taller", () => {
    for (const columns of [12, 24, 44, 96, 200]) {
      let previous = 0;
      for (let rows = 0; rows <= 60; rows += 1) {
        const fit = computeSplashFit({ columns, rows }, 7);
        expect(fit.infoRows).toBeGreaterThanOrEqual(previous);
        previous = fit.infoRows;
      }
      expect(previous).toBe(7);
    }
  });

  it("never shows fewer tips as the terminal grows within a fixed layout", () => {
    const perLayout = new Map<string, number>();
    for (let rows = 2; rows <= 80; rows += 1) {
      const { logo, infoRows, tipCount } = computeSplashFit({ columns: 96, rows }, 7);
      const key = logo + ":" + infoRows;
      expect(tipCount).toBeGreaterThanOrEqual(perLayout.get(key) ?? 0);
      perLayout.set(key, tipCount);
    }
    expect(perLayout.get("full:7")).toBe(6);
  });
});
