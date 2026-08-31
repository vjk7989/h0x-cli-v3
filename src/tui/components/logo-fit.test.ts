import { describe, expect, it } from "vitest";
import stringWidth from "string-width";
import { LOGO_ART } from "./logo.js";
import { LOGO_METRICS, type LogoVariant } from "./splash-fit.js";

function measure(rows: readonly string[]): { width: number; height: number } {
  return {
    width: rows.reduce((acc, row) => Math.max(acc, stringWidth(row)), 0),
    height: rows.length,
  };
}

/**
 * `splash-fit.ts` picks a mark from numbers it keeps in `LOGO_METRICS`;
 * the artwork itself lives in `logo.tsx`. If the two ever drift the
 * breakpoints silently start lying, so measure the real rows here.
 */
describe("logo artwork", () => {
  const variants: readonly LogoVariant[] = ["full", "small", "mini", "tiny"];

  it.each(variants)("matches the declared metrics for %s", (variant) => {
    expect(measure(LOGO_ART[variant])).toEqual(LOGO_METRICS[variant]);
  });

  it("orders artwork largest first and preserves both compact aliases", () => {
    expect(LOGO_METRICS.full.width).toBeGreaterThan(LOGO_METRICS.small.width);
    expect(LOGO_METRICS.small.width).toBeGreaterThan(LOGO_METRICS.mini.width);
    expect(LOGO_METRICS.mini).toEqual(LOGO_METRICS.tiny);
    expect(LOGO_METRICS.full.height).toBe(LOGO_METRICS.small.height);
    expect(LOGO_METRICS.small.height).toBeGreaterThan(LOGO_METRICS.mini.height);
  });

  it("pins the four approved wordmark footprints", () => {
    expect(LOGO_METRICS).toEqual({
      full: { width: 82, height: 7 },
      small: { width: 47, height: 7 },
      mini: { width: 7, height: 1 },
      tiny: { width: 7, height: 1 },
    });
    expect(LOGO_ART.tiny).toEqual(["h0x-cli"]);
  });

  it("uses dense dotted cells and doubles glyph pixels without doubling letter gaps or rows", () => {
    for (let row = 0; row < 7; row += 1) {
      const small = LOGO_ART.small[row]!;
      const full = LOGO_ART.full[row]!;
      expect(small).toMatch(/^[ \u28ff]+$/u);
      expect(full).toMatch(/^[ \u28ff]+$/u);
      expect(stringWidth(small)).toBe(47);
      expect(stringWidth(full)).toBe(82);
      for (let glyph = 0; glyph < 7; glyph += 1) {
        const pixels = small.slice(glyph * 7, glyph * 7 + 5);
        expect(full.slice(glyph * 12, glyph * 12 + 10))
          .toBe([...pixels].map((cell) => cell.repeat(2)).join(""));
        if (glyph < 6) {
          expect(small.slice(glyph * 7 + 5, glyph * 7 + 7)).toBe("  ");
          expect(full.slice(glyph * 12 + 10, glyph * 12 + 12)).toBe("  ");
        }
      }
    }
    const glyph = (index: number): string[] => LOGO_ART.small.map((row) => row.slice(index * 7, index * 7 + 5));
    expect(glyph(6)[0]).toContain("\u28ff");
    expect(glyph(6)[1]).toBe("     ");
    expect(glyph(5)).not.toEqual(glyph(6));
    expect(glyph(5)[5]).toBe(" \u28ff   ");
    expect(glyph(5)[6]).toBe("  \u28ff\u28ff\u28ff");
    expect(glyph(1)[2]?.[3]).toBe("\u28ff");
    expect(glyph(1)[3]?.[2]).toBe("\u28ff");
    expect(glyph(1)[4]?.[1]).toBe("\u28ff");
  });
});
