import chalk from "chalk";
import stringWidth from "string-width";
import { render } from "ink-testing-library";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { computeOnboardingFit } from "../onboarding/onboarding-fit.js";
import { parseHexColor } from "../theme/parse-hex-color.js";
import { theme } from "../theme/theme.js";
import { renderAtSize } from "../test-sized-render.js";
import { LOGO_ART } from "./logo.js";
import { OnboardingIntroStep } from "./onboarding-intro-step.js";

const strip = (frame: string): string => frame.replace(/\u001B\[[0-9;]*m/gu, "");

function frameAt(columns: number, rows: number): string {
  const view = renderAtSize(
    <OnboardingIntroStep columns={columns - 4} rows={rows - 2}
      fit={computeOnboardingFit({ columns, rows })} skipAnimation />,
    { columns, rows },
  );
  const frame = view.lastFrame() ?? "";
  view.unmount();
  return frame;
}

describe("OnboardingIntroStep", () => {
  let level: typeof chalk.level;
  beforeAll(() => { level = chalk.level; chalk.level = 3; });
  afterAll(() => { chalk.level = level; });

  it("shares the dotted artwork with empty chat and shows the product links", () => {
    const frame = strip(frameAt(120, 40));
    for (const row of LOGO_ART.full) expect(frame).toContain(row.trimEnd());
    for (const text of ["h0x-cli", "Built by TEAM PAVii.Ai", "https://pavii.tech", "docs (placeholder)", "[ press any key to continue ]"]) {
      expect(frame).toContain(text);
    }
    expect(frame).not.toContain("Local AI-First Agent");
  });

  it("paints the plain product name in the text-safe brand colour", () => {
    const row = frameAt(100, 30).split("\n").find((line) => strip(line).includes("h0x-cli"));
    const rgb = parseHexColor(theme.colors.brandMark);
    if (!rgb) throw new Error("Invalid brand colour");
    expect(row).toContain("\u001b[38;2;" + rgb.r + ";" + rgb.g + ";" + rgb.b + "m");
    expect(row).toContain("\u001b[1m");
  });

  it.each([
    [120, 40], [100, 30], [80, 24], [72, 18], [64, 16], [40, 12],
  ])("keeps artwork, info and invitation inside %sx%s", (columns, rows) => {
    const frame = strip(frameAt(columns, rows));
    const lines = frame.trimEnd().split("\n");
    expect(lines.length).toBeLessThanOrEqual(rows - 2);
    expect(Math.max(...lines.map((line) => stringWidth(line)))).toBeLessThanOrEqual(columns - 4);
    expect(frame).toContain("h0x-cli");
    expect(frame).toContain("press any key to continue");
  });

  it("skips the attribution reveal immediately when requested", () => {
    expect(strip(frameAt(100, 30))).toContain("Built by TEAM PAVii.Ai");
  });

  it("keeps the brand static while attribution reveals and supports skipping mid-reveal", async () => {
    const props = { columns: 96, rows: 28, fit: computeOnboardingFit({ columns: 100, rows: 30 }) };
    const view = render(<OnboardingIntroStep {...props} skipAnimation={false} />);
    try {
      const first = strip(view.lastFrame() ?? "");
      expect(first).toContain("h0x-cli");
      expect(first).toContain("https://pavii.tech");
      expect(first).not.toContain("Built by TEAM PAVii.Ai");
      view.rerender(<OnboardingIntroStep {...props} skipAnimation />);
      await vi.waitFor(() => {
        expect(strip(view.lastFrame() ?? "")).toContain("Built by TEAM PAVii.Ai");
      });
      expect(strip(view.lastFrame() ?? "")).toContain("press any key to continue");
    } finally {
      view.unmount();
    }
  });
});
