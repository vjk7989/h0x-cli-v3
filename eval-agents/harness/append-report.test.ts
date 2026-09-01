import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { appendCsvRow, appendJsonlRow } from "./append-report.js";
import type { GaiaAgentRunResult, GaiaRow } from "./gaia-types.js";

const tempDirs: string[] = [];
const TMP_ROOT = resolve("G:\\h0xi\\atomic-agent", "tmp", "gaia-report-tests");

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("GAIA report appending", () => {
  it("records wrong answers as scored rows", () => {
    const dir = join(TMP_ROOT, String(Date.now()));
    mkdirSync(dir, { recursive: true });
    tempDirs.push(dir);
    const csvPath = join(dir, "matrix.csv");
    const jsonlPath = join(dir, "matrix.jsonl");
    const row: GaiaRow = {
      task_id: "wrong-answer-fixture",
      Question: "Capital of Norway?",
      Level: 1,
      "Final answer": "Oslo",
      file_name: "",
      file_path: "",
    };
    const result: GaiaAgentRunResult = {
      agentId: "h0x-cli",
      taskId: row.task_id,
      rawReply: "FINAL ANSWER: Bergen",
      extractedAnswer: "Bergen",
      correct: false,
      metrics: {
        stepCount: 3,
        promptTokens: 120,
        predictedTokens: 8,
        toolErrors: 0,
        wallClockMs: 456,
        timedOut: false,
        exitCode: 0,
      },
      skipped: false,
      skipReason: null,
      error: null,
    };

    expect(() => appendCsvRow(csvPath, row, result)).not.toThrow();
    expect(() => appendJsonlRow(jsonlPath, row, result)).not.toThrow();

    const csv = readFileSync(csvPath, "utf8");
    expect(csv).toContain("h0x-cli,wrong-answer-fixture,1,0,0,");
    expect(csv).toContain("Bergen,Oslo");

    const jsonl = readFileSync(jsonlPath, "utf8").trim().split("\n")[0];
    expect(JSON.parse(jsonl ?? "{}").result).toMatchObject({
      agentId: "h0x-cli",
      correct: false,
      extractedAnswer: "Bergen",
    });
    expect(JSON.parse(jsonl ?? "{}").result.rawReply).toBeUndefined();
  });

  it("classifies max-step benchmark errors without writing prompt or gold answer to JSONL", () => {
    const dir = join(TMP_ROOT, `${Date.now()}-max-steps`);
    mkdirSync(dir, { recursive: true });
    tempDirs.push(dir);
    const jsonlPath = join(dir, "matrix.jsonl");
    const row: GaiaRow = {
      task_id: "synthetic-max-step-fixture",
      Question: "SENSITIVE_SYNTHETIC_PROMPT_SHOULD_NOT_BE_WRITTEN",
      Level: 1,
      "Final answer": "SENSITIVE_SYNTHETIC_GOLD_SHOULD_NOT_BE_WRITTEN",
      file_name: "fixture.txt",
      file_path: "fixture.txt",
    };
    const result: GaiaAgentRunResult = {
      agentId: "h0x-cli",
      taskId: row.task_id,
      rawReply: "",
      extractedAnswer: "",
      correct: false,
      metrics: {
        stepCount: 30,
        promptTokens: 1200,
        predictedTokens: 300,
        toolErrors: 0,
        wallClockMs: 90000,
        timedOut: false,
        exitCode: 1,
      },
      skipped: false,
      skipReason: null,
      error: "max_steps_reached",
    };

    appendJsonlRow(jsonlPath, row, result);

    const jsonl = readFileSync(jsonlPath, "utf8");
    expect(jsonl).toContain('"errorCategory":"max_steps_reached"');
    expect(jsonl).toContain('"task_id":"synthetic-max-step-fixture"');
    expect(jsonl).not.toContain("SENSITIVE_SYNTHETIC_PROMPT_SHOULD_NOT_BE_WRITTEN");
    expect(jsonl).not.toContain("SENSITIVE_SYNTHETIC_GOLD_SHOULD_NOT_BE_WRITTEN");
  });

  it("keeps attachment metadata for failure triage while scrubbing benchmark content", () => {
    const dir = join(TMP_ROOT, `${Date.now()}-attachment-metadata`);
    mkdirSync(dir, { recursive: true });
    tempDirs.push(dir);
    const jsonlPath = join(dir, "matrix.jsonl");
    const row: GaiaRow = {
      task_id: "synthetic-attachment-failure",
      Question: "SENSITIVE_AUDIO_PROMPT_SHOULD_NOT_BE_WRITTEN",
      Level: 1,
      "Final answer": "SENSITIVE_AUDIO_GOLD_SHOULD_NOT_BE_WRITTEN",
      file_name: "sample.mp3",
      file_path: "level1/sample.mp3",
    };
    const result: GaiaAgentRunResult = {
      agentId: "h0x-cli",
      taskId: row.task_id,
      rawReply: "SENSITIVE_RAW_REPLY_SHOULD_NOT_BE_WRITTEN",
      extractedAnswer: "",
      correct: false,
      metrics: {
        stepCount: 12,
        promptTokens: 1200,
        predictedTokens: 100,
        toolErrors: 4,
        wallClockMs: 42000,
        timedOut: false,
        exitCode: 1,
      },
      skipped: false,
      skipReason: null,
      error: "max_steps_reached: 12 steps without reply",
    };

    appendJsonlRow(jsonlPath, row, result);

    const jsonl = readFileSync(jsonlPath, "utf8");
    expect(jsonl).toContain('"file_name":"sample.mp3"');
    expect(jsonl).toContain('"file_path":"level1/sample.mp3"');
    expect(jsonl).not.toContain("SENSITIVE_AUDIO_PROMPT_SHOULD_NOT_BE_WRITTEN");
    expect(jsonl).not.toContain("SENSITIVE_AUDIO_GOLD_SHOULD_NOT_BE_WRITTEN");
    expect(jsonl).not.toContain("SENSITIVE_RAW_REPLY_SHOULD_NOT_BE_WRITTEN");
  });

  it("classifies launcher crashes separately from wrong benchmark answers", () => {
    const dir = join(TMP_ROOT, `${Date.now()}-process-exit`);
    mkdirSync(dir, { recursive: true });
    tempDirs.push(dir);
    const jsonlPath = join(dir, "matrix.jsonl");
    const row: GaiaRow = {
      task_id: "synthetic-process-exit",
      Question: "Synthetic prompt",
      Level: 1,
      "Final answer": "Synthetic answer",
      file_name: "",
      file_path: "",
    };
    const result: GaiaAgentRunResult = {
      agentId: "h0x-cli",
      taskId: row.task_id,
      rawReply: "",
      extractedAnswer: "",
      correct: false,
      metrics: {
        stepCount: null,
        promptTokens: null,
        predictedTokens: null,
        toolErrors: null,
        wallClockMs: 3000,
        timedOut: false,
        exitCode: 3221226505,
      },
      skipped: false,
      skipReason: null,
      error: "process_exit_3221226505",
    };

    appendJsonlRow(jsonlPath, row, result);

    const parsed = JSON.parse(readFileSync(jsonlPath, "utf8"));
    expect(parsed.errorCategory).toBe("process_exit");
    expect(parsed.result.rawReply).toBeUndefined();
  });

  it("classifies provider rate limits separately from benchmark wrong answers", () => {
    const dir = join(TMP_ROOT, `${Date.now()}-provider-rate-limit`);
    mkdirSync(dir, { recursive: true });
    tempDirs.push(dir);
    const jsonlPath = join(dir, "matrix.jsonl");
    const row: GaiaRow = {
      task_id: "synthetic-provider-rate-limit",
      Question: "Synthetic prompt",
      Level: 1,
      "Final answer": "Synthetic answer",
      file_name: "",
      file_path: "",
    };
    const result: GaiaAgentRunResult = {
      agentId: "h0x-cli",
      taskId: row.task_id,
      rawReply: "",
      extractedAnswer: "",
      correct: false,
      metrics: {
        stepCount: null,
        promptTokens: null,
        predictedTokens: null,
        toolErrors: null,
        wallClockMs: 64000,
        timedOut: false,
        exitCode: 0,
      },
      skipped: false,
      skipReason: null,
      error: '"gemini" is rate-limiting this key (429). Tried 3 times.',
    };

    appendJsonlRow(jsonlPath, row, result);

    const parsed = JSON.parse(readFileSync(jsonlPath, "utf8"));
    expect(parsed.errorCategory).toBe("provider_rate_limit");
  });
});
