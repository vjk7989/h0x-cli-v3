import { describe, expect, it } from "vitest";

import type { GaiaAgentRunResult, GaiaRow } from "./gaia-types.js";
import {
  TEST_SPLIT_COUNTS,
  buildGaiaSubmissionJsonl,
  validateGaiaSubmissionJsonl,
} from "./gaia-submission.js";

function makeRow(taskId: string, level: 1 | 2 | 3): GaiaRow {
  return {
    task_id: taskId,
    Question: `Question ${taskId}`,
    Level: level,
    "Final answer": "",
    file_name: "",
    file_path: "",
  };
}

function makeResult(
  taskId: string,
  extractedAnswer: string,
  extra: Partial<GaiaAgentRunResult> = {},
): GaiaAgentRunResult {
  return {
    agentId: "h0x-cli",
    taskId,
    rawReply: `FINAL ANSWER: ${extractedAnswer}`,
    extractedAnswer,
    correct: false,
    metrics: {
      stepCount: 2,
      promptTokens: 100,
      predictedTokens: 10,
      toolErrors: 0,
      wallClockMs: 1234,
      timedOut: false,
      exitCode: 0,
    },
    skipped: false,
    skipReason: null,
    error: null,
    ...extra,
  };
}

function makeOfficialTestRows(): GaiaRow[] {
  const rows: GaiaRow[] = [];
  for (let i = 0; i < TEST_SPLIT_COUNTS.level1; i += 1) {
    rows.push(makeRow(`test-l1-${i}`, 1));
  }
  for (let i = 0; i < TEST_SPLIT_COUNTS.level2; i += 1) {
    rows.push(makeRow(`test-l2-${i}`, 2));
  }
  for (let i = 0; i < TEST_SPLIT_COUNTS.level3; i += 1) {
    rows.push(makeRow(`test-l3-${i}`, 3));
  }
  expect(rows).toHaveLength(TEST_SPLIT_COUNTS.total);
  return rows;
}

describe("GAIA leaderboard submission JSONL", () => {
  it("exports official rows with task_id and model_answer strings plus optional reasoning_trace", () => {
    const rows = [
      makeRow("alpha", 1),
      makeRow("beta", 1),
    ];
    const results = [
      {
        row: rows[0]!,
        result: makeResult("alpha", "17"),
        reasoningTrace: "read the attachment, computed 12 + 5",
      },
      {
        row: rows[1]!,
        result: makeResult("beta", "PAVii"),
      },
    ];

    const jsonl = buildGaiaSubmissionJsonl(results);
    const parsed = jsonl
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(parsed).toEqual([
      {
        task_id: "alpha",
        model_answer: "17",
        reasoning_trace: "read the attachment, computed 12 + 5",
      },
      {
        task_id: "beta",
        model_answer: "PAVii",
      },
    ]);
  });

  it("validates the official GAIA test split counts and required task coverage", () => {
    const rows = makeOfficialTestRows();
    const jsonl = rows
      .map((row, index) =>
        JSON.stringify({
          task_id: row.task_id,
          model_answer: String(index),
        }),
      )
      .join("\n");

    const report = validateGaiaSubmissionJsonl(jsonl, {
      split: "test",
      expectedRows: rows,
    });

    expect(report.ok).toBe(true);
    expect(report.counts).toEqual(TEST_SPLIT_COUNTS);
    expect(report.errors).toEqual([]);
  });

  it("rejects missing ids, duplicate ids, wrong test counts, and non-string answers", () => {
    const rows = makeOfficialTestRows();
    const jsonl = [
      JSON.stringify({ task_id: rows[0]!.task_id, model_answer: "first" }),
      JSON.stringify({ task_id: rows[0]!.task_id, model_answer: "duplicate" }),
      JSON.stringify({ task_id: rows[1]!.task_id, model_answer: 42 }),
    ].join("\n");

    const report = validateGaiaSubmissionJsonl(jsonl, {
      split: "test",
      expectedRows: rows,
    });

    expect(report.ok).toBe(false);
    expect(report.errors).toContainEqual(
      expect.objectContaining({
        code: "duplicate_task_id",
        taskId: rows[0]!.task_id,
      }),
    );
    expect(report.errors).toContainEqual(
      expect.objectContaining({
        code: "non_string_model_answer",
        line: 3,
      }),
    );
    expect(report.errors).toContainEqual(
      expect.objectContaining({
        code: "missing_task_ids",
      }),
    );
    expect(report.errors).toContainEqual(
      expect.objectContaining({
        code: "wrong_test_split_counts",
        expected: TEST_SPLIT_COUNTS,
      }),
    );
  });

  it("rejects malformed JSONL with a line-specific error", () => {
    const rows = makeOfficialTestRows();
    const report = validateGaiaSubmissionJsonl(
      `${JSON.stringify({ task_id: rows[0]!.task_id, model_answer: "ok" })}\n{broken`,
      {
        split: "test",
        expectedRows: rows,
      },
    );

    expect(report.ok).toBe(false);
    expect(report.errors).toContainEqual(
      expect.objectContaining({
        code: "malformed_jsonl",
        line: 2,
      }),
    );
  });
});
