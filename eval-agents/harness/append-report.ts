import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { GaiaAgentRunResult } from "./gaia-types.js";
import type { GaiaRow } from "./gaia-types.js";

const CSV_HEADER =
  "timestamp,agent_id,task_id,level,correct,skipped,skip_reason,wall_clock_ms,steps,prompt_tokens,predicted_tokens,tool_errors,extracted_answer,gold_answer\n";

export function ensureReportHeader(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) {
    writeFileSync(path, CSV_HEADER, "utf8");
  }
}

export function appendCsvRow(
  path: string,
  row: GaiaRow,
  result: GaiaAgentRunResult,
): void {
  ensureReportHeader(path);
  const line = [
    new Date().toISOString(),
    csvEscape(result.agentId),
    csvEscape(result.taskId),
    String(row.Level),
    result.correct ? "1" : "0",
    result.skipped ? "1" : "0",
    csvEscape(result.skipReason ?? ""),
    String(result.metrics.wallClockMs),
    String(result.metrics.stepCount ?? ""),
    String(result.metrics.promptTokens ?? ""),
    String(result.metrics.predictedTokens ?? ""),
    String(result.metrics.toolErrors ?? ""),
    csvEscape(result.extractedAnswer),
    csvEscape(row["Final answer"]),
  ].join(",");
  appendFileSync(path, `${line}\n`, "utf8");
}

export function appendJsonlRow(
  path: string,
  row: GaiaRow,
  result: GaiaAgentRunResult,
): void {
  mkdirSync(dirname(path), { recursive: true });
  const record = {
    at: new Date().toISOString(),
    row: sanitizeGaiaRow(row),
    result: sanitizeResult(result),
    errorCategory: classifyError(result),
  };
  appendFileSync(path, `${JSON.stringify(record)}\n`, "utf8");
}

function sanitizeGaiaRow(row: GaiaRow): Pick<GaiaRow, "task_id" | "Level" | "file_name" | "file_path"> {
  return {
    task_id: row.task_id,
    Level: row.Level,
    file_name: row.file_name,
    file_path: row.file_path,
  };
}

function sanitizeResult(result: GaiaAgentRunResult): Omit<GaiaAgentRunResult, "rawReply"> {
  const { rawReply: _rawReply, ...safeResult } = result;
  return safeResult;
}

function classifyError(result: GaiaAgentRunResult): string | null {
  const error = result.error;
  if (error) {
    if (/\b429\b|rate-?limit/i.test(error)) return "provider_rate_limit";
    if (/max_steps_reached/i.test(error)) return "max_steps_reached";
    if (/timeout/i.test(error)) return "timeout";
    if (/^process_exit_/i.test(error)) return "process_exit";
    if (/invalid_final_format/i.test(error)) return "invalid_final_format";
    return "run_error";
  }
  if (!result.rawReply.trim() && !result.extractedAnswer.trim()) return "blank_reply";
  if (result.metrics.exitCode === 0 && result.metrics.stepCount === null) return "missing_trace";
  return null;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
