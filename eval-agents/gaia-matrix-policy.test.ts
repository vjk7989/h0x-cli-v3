import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("GAIA matrix policy", () => {
  it("does not hard-fail wrong answers after writing report rows", () => {
    const source = readFileSync(resolve("eval-agents", "gaia.eval.ts"), "utf8");

    expect(source).toContain("appendCsvRow(CSV_PATH, row, result);");
    expect(source).toContain("appendJsonlRow(JSONL_PATH, row, result);");
    expect(source).not.toContain("expect(result.correct");
  });

  it("uses h0x env aliases before legacy GAIA source, split, limit, and pacing knobs", () => {
    const evalSource = readFileSync(resolve("eval-agents", "gaia.eval.ts"), "utf8");
    const matrixSource = readFileSync(
      resolve("eval-agents", "scripts", "run-matrix.mjs"),
      "utf8",
    );

    expect(evalSource).toContain(
      'readEvalEnv("H0X_CLI_GAIA_SOURCE", "ATOMIC_AGENT_GAIA_SOURCE")',
    );
    expect(evalSource).toContain(
      'readEvalEnv("H0X_CLI_GAIA_SPLIT", "ATOMIC_AGENT_GAIA_SPLIT")',
    );
    expect(evalSource).toContain(
      'readEvalEnv("H0X_CLI_GAIA_LIMIT", "ATOMIC_AGENT_GAIA_LIMIT")',
    );
    expect(evalSource).toContain(
      'readEvalEnv("H0X_CLI_GAIA_CASE_DELAY_MS", "ATOMIC_AGENT_GAIA_CASE_DELAY_MS")',
    );
    expect(evalSource).toContain("await delayBetweenCases(caseDelayMs);");
    expect(matrixSource).toContain(
      'readEvalEnv("H0X_CLI_GAIA_SOURCE", "ATOMIC_AGENT_GAIA_SOURCE")',
    );
    expect(matrixSource).toContain(
      'readEvalEnv("H0X_CLI_GAIA_SPLIT", "ATOMIC_AGENT_GAIA_SPLIT")',
    );
  });
});
