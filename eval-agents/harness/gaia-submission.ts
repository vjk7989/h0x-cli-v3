import type { GaiaAgentRunResult, GaiaRow } from "./gaia-types.js";

export interface GaiaSubmissionInput {
  row: GaiaRow;
  result: GaiaAgentRunResult;
  reasoningTrace?: string;
}

export interface GaiaSubmissionError {
  code:
    | "malformed_jsonl"
    | "row_not_object"
    | "missing_task_id"
    | "non_string_model_answer"
    | "duplicate_task_id"
    | "unexpected_task_ids"
    | "missing_task_ids"
    | "wrong_test_split_counts";
  line?: number;
  taskId?: string;
  expected?: SplitCounts;
  actual?: SplitCounts;
  message: string;
}

export interface SplitCounts {
  total: number;
  level1: number;
  level2: number;
  level3: number;
}

export interface GaiaSubmissionValidationReport {
  ok: boolean;
  counts: SplitCounts;
  errors: GaiaSubmissionError[];
}

export const TEST_SPLIT_COUNTS: SplitCounts = {
  total: 301,
  level1: 93,
  level2: 159,
  level3: 49,
};

export const VALIDATION_SPLIT_COUNTS: SplitCounts = {
  total: 165,
  level1: 53,
  level2: 86,
  level3: 26,
};

export function buildGaiaSubmissionJsonl(inputs: readonly GaiaSubmissionInput[]): string {
  if (inputs.length === 0) return "";
  return `${inputs
    .map(({ result, reasoningTrace }) => {
      const row: Record<string, string> = {
        task_id: result.taskId,
        model_answer: result.extractedAnswer,
      };
      if (reasoningTrace) row.reasoning_trace = reasoningTrace;
      return JSON.stringify(row);
    })
    .join("\n")}\n`;
}

export function validateGaiaSubmissionJsonl(
  jsonl: string,
  options: {
    split?: "validation" | "test";
    expectedRows?: readonly GaiaRow[];
  } = {},
): GaiaSubmissionValidationReport {
  const parsedRows: unknown[] = [];
  const errors: GaiaSubmissionError[] = [];
  const lines = jsonl
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter(({ line }) => line.length > 0);

  for (const { line, lineNumber } of lines) {
    try {
      parsedRows.push(JSON.parse(line));
    } catch {
      errors.push({
        code: "malformed_jsonl",
        line: lineNumber,
        message: `line ${lineNumber} is not valid JSON`,
      });
    }
  }

  const seen = new Set<string>();
  const duplicateIds = new Set<string>();
  const submittedIds: string[] = [];
  parsedRows.forEach((row, index) => {
    const line = index + 1;
    if (!isRecord(row)) {
      errors.push({ code: "row_not_object", line, message: "row must be an object" });
      return;
    }
    if (typeof row.task_id !== "string" || row.task_id.trim() === "") {
      errors.push({ code: "missing_task_id", line, message: "task_id must be a string" });
      return;
    }
    submittedIds.push(row.task_id);
    if (seen.has(row.task_id)) duplicateIds.add(row.task_id);
    seen.add(row.task_id);
    if (typeof row.model_answer !== "string") {
      errors.push({
        code: "non_string_model_answer",
        line,
        taskId: row.task_id,
        message: "model_answer must be a string",
      });
    }
  });

  for (const taskId of duplicateIds) {
    errors.push({
      code: "duplicate_task_id",
      taskId,
      message: `duplicate task_id ${taskId}`,
    });
  }

  const counts = countSubmittedLevels(submittedIds, options.expectedRows ?? []);
  validateExpectedCoverage({
    counts,
    errors,
    expectedRows: options.expectedRows ?? [],
    seen,
    split: options.split,
  });

  return { ok: errors.length === 0, counts, errors };
}

function validateExpectedCoverage(opts: {
  counts: SplitCounts;
  errors: GaiaSubmissionError[];
  expectedRows: readonly GaiaRow[];
  seen: Set<string>;
  split?: "validation" | "test";
}): void {
  const { errors, expectedRows, seen, split } = opts;
  if (expectedRows.length === 0) return;

  const expectedIds = new Set(expectedRows.map((row) => row.task_id));
  const missing = expectedRows.filter((row) => !seen.has(row.task_id));
  const unexpected = [...seen].filter((taskId) => !expectedIds.has(taskId));

  if (missing.length > 0) {
    errors.push({
      code: "missing_task_ids",
      message: `missing ${missing.length} expected task_id values`,
    });
  }
  if (unexpected.length > 0) {
    errors.push({
      code: "unexpected_task_ids",
      message: `found ${unexpected.length} unexpected task_id values`,
    });
  }

  if (split === "test") {
    const actual = countExpectedLevels(expectedRows.filter((row) => seen.has(row.task_id)));
    if (!sameCounts(actual, TEST_SPLIT_COUNTS)) {
      errors.push({
        code: "wrong_test_split_counts",
        expected: TEST_SPLIT_COUNTS,
        actual,
        message: `test split must contain ${TEST_SPLIT_COUNTS.total} rows`,
      });
    }
  }
}

function countSubmittedLevels(ids: readonly string[], expectedRows: readonly GaiaRow[]): SplitCounts {
  const levelById = new Map(expectedRows.map((row) => [row.task_id, Number(row.Level)]));
  const counts: SplitCounts = { total: ids.length, level1: 0, level2: 0, level3: 0 };
  for (const id of ids) {
    const level = levelById.get(id);
    if (level === 1) counts.level1 += 1;
    if (level === 2) counts.level2 += 1;
    if (level === 3) counts.level3 += 1;
  }
  return counts;
}

function countExpectedLevels(rows: readonly GaiaRow[]): SplitCounts {
  return {
    total: rows.length,
    level1: rows.filter((row) => Number(row.Level) === 1).length,
    level2: rows.filter((row) => Number(row.Level) === 2).length,
    level3: rows.filter((row) => Number(row.Level) === 3).length,
  };
}

function sameCounts(a: SplitCounts, b: SplitCounts): boolean {
  return a.total === b.total && a.level1 === b.level1 && a.level2 === b.level2 && a.level3 === b.level3;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
