import { describe, expect, it } from "vitest";

import { buildGaiaUserPrompt, extractFinalAnswer } from "./extract-answer.js";

describe("extractFinalAnswer", () => {
  it("reads FINAL ANSWER marker", () => {
    const reply = "Worked through the file.\nFINAL ANSWER: Oslo";
    expect(extractFinalAnswer(reply)).toBe("Oslo");
  });

  it("falls back to last line", () => {
    expect(extractFinalAnswer("step 1\nstep 2\n42")).toBe("42");
  });

  it("picks the LAST FINAL ANSWER when restated", () => {
    const reply = "FINAL ANSWER: maybe Paris\nWait, reconsidering.\nFINAL ANSWER: Oslo";
    expect(extractFinalAnswer(reply)).toBe("Oslo");
  });

  it("reads the answer from the next line when marker is alone", () => {
    expect(extractFinalAnswer("Reasoning...\nFINAL ANSWER:\nOslo")).toBe("Oslo");
  });

  it("strips wrapping quotes", () => {
    expect(extractFinalAnswer('FINAL ANSWER: "red, blue"')).toBe("red, blue");
  });

  it("returns empty string for blank reply", () => {
    expect(extractFinalAnswer("   \n  ")).toBe("");
  });
});

describe("buildGaiaUserPrompt", () => {
  it("keeps the benchmark prompt on one line for stdin delivery", () => {
    const prompt = buildGaiaUserPrompt(
      "Line one?\nLine two with\tspacing.",
      "notes.txt",
    );

    expect(prompt).not.toMatch(/\r|\n/);
    expect(prompt).toContain("Question: Line one? Line two with spacing.");
    expect(prompt).toContain("Attached file(s) are in the workspace: notes.txt.");
  });

  it("instructs the agent to stop tool use and answer once evidence is sufficient", () => {
    const prompt = buildGaiaUserPrompt("What is the short answer?", null);

    expect(prompt).toMatch(/once .*sufficient evidence/i);
    expect(prompt).toMatch(/stop .*tool/i);
    expect(prompt).toContain("FINAL ANSWER: <your answer>");
  });

  it("discourages package-install loops when optional media or document tooling is unavailable", () => {
    const prompt = buildGaiaUserPrompt(
      "Use the attached audio or spreadsheet to answer.",
      "sample.mp3, workbook.xlsx",
    );

    expect(prompt).toMatch(/do not install packages/i);
    expect(prompt).toMatch(/optional tools?.*decoder/i);
    expect(prompt).toMatch(/after one unavailable/i);
    expect(prompt).toMatch(/answer best-effort/i);
    expect(prompt).toMatch(/at most eight tool calls/i);
    expect(prompt).toMatch(/reserve .*reply/i);
    expect(prompt).toMatch(/\.xlsx files/i);
    expect(prompt).toMatch(/\[fill=\.\.\.\]/i);
    expect(prompt).toContain("sample.mp3, workbook.xlsx");
  });

  it("places required attachment evidence before the question", () => {
    const prompt = buildGaiaUserPrompt(
      "Which cell is reached?",
      "map.xlsx. Pre-extracted workbook summary: START A1 [fill=FFFFCC00]",
    );

    const evidenceIndex = prompt.indexOf("Attachment evidence is required");
    const summaryIndex = prompt.indexOf("Pre-extracted workbook summary");
    const questionIndex = prompt.indexOf("Question:");
    expect(evidenceIndex).toBeGreaterThan(-1);
    expect(summaryIndex).toBeGreaterThan(evidenceIndex);
    expect(questionIndex).toBeGreaterThan(summaryIndex);
    expect(prompt).toMatch(/inspect the file or use the pre-extracted attachment evidence/i);
  });
});
