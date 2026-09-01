import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { AgentAdapter } from "./agent-adapter.js";
import type { GaiaRow, GaiaAgentRunResult } from "./gaia-types.js";
import { buildGaiaUserPrompt, extractFinalAnswer } from "./extract-answer.js";
import { questionScorer } from "./score-gaia.js";
import { createGaiaWorkspace } from "./temp-workspace.js";
import { preserveTraceFiles } from "./preserve-traces.js";
import { buildXlsxGridAnalysis } from "./xlsx-grid-analysis.js";

export interface RunGaiaCaseOptions {
  adapter: AgentAdapter;
  row: GaiaRow;
  chatUrl: string;
  embedUrl: string | null;
  maxSteps?: number;
  timeoutMs?: number;
  split?: "validation" | "test";
  /**
   * When set, per-case NDJSON traces are copied into
   * `<tracesOutDir>/<taskId>/` before the temp-workspace is deleted.
   */
  tracesOutDir?: string;
}

export async function runGaiaCase(opts: RunGaiaCaseOptions): Promise<GaiaAgentRunResult> {
  const missing = opts.adapter.probeRequirements();
  if (missing.length > 0) {
    return {
      agentId: opts.adapter.id,
      taskId: opts.row.task_id,
      rawReply: "",
      extractedAnswer: "",
      correct: false,
      metrics: emptyMetrics(),
      skipped: true,
      skipReason: missing.join("; "),
      error: null,
    };
  }

  const workspace = createGaiaWorkspace(opts.row.task_id, opts.row, opts.split ?? "validation");
  try {
    const attachmentHint = await buildAttachmentHint(workspace.workingDir, opts.row);
    const prompt = buildGaiaUserPrompt(opts.row.Question, attachmentHint);
    const raw = await opts.adapter.runQuestion({
      row: opts.row,
      workingDir: workspace.workingDir,
      stateDir: workspace.stateDir,
      prompt,
      maxSteps: opts.maxSteps ?? 30,
      timeoutMs: opts.timeoutMs ?? 600_000,
      chatUrl: opts.chatUrl,
      embedUrl: opts.embedUrl,
    });

    const extracted = extractFinalAnswer(raw.rawReply);
    const correct = questionScorer(extracted, opts.row["Final answer"]);
    const formatError = isInvalidFinalFormat(raw.rawReply, extracted)
      ? "invalid_final_format"
      : null;

    return {
      agentId: opts.adapter.id,
      taskId: opts.row.task_id,
      rawReply: raw.rawReply,
      extractedAnswer: extracted,
      correct,
      metrics: raw.metrics,
      skipped: false,
      skipReason: null,
      error: raw.error ?? formatError,
    };
  } finally {
    if (opts.tracesOutDir) {
      preserveTraceFiles(workspace.stateDir, opts.tracesOutDir, opts.row.task_id);
    }
    workspace.cleanup();
  }
}

function isInvalidFinalFormat(rawReply: string, extractedAnswer: string): boolean {
  if (rawReply.trim().length === 0) return false;
  if (/FINAL\s+ANSWER\s*:/i.test(rawReply)) return false;
  const answer = extractedAnswer.trim();
  if (answer.length === 0) return false;
  if (/^```/.test(rawReply.trim())) return true;
  if (/^\[?\s*\{\s*"tool"\s*:/i.test(answer)) return true;
  if (/^json\s+\[?\s*\{\s*"tool"\s*:/i.test(answer)) return true;
  return false;
}

export async function buildAttachmentHint(workingDir: string, row: GaiaRow): Promise<string | null> {
  if (!row.file_name) return null;
  if (!row.file_name.toLowerCase().endsWith(".xlsx")) return row.file_name;

  try {
    const { xlsxExtractor } = await import("../../src/tools/os/read-document/extractors/xlsx-extractor.js");
    const sourcePath = join(workingDir, row.file_name);
    const data = await readFile(sourcePath);
    const extracted = await xlsxExtractor({ data, sourcePath });
    const summary = collapseWhitespace(extracted.text).slice(0, 12_000);
    const gridAnalysis = await buildXlsxGridAnalysis(sourcePath, row.Question);
    const gridHint = gridAnalysis ? ` ${gridAnalysis}` : "";
    return `${row.file_name}. Pre-extracted workbook summary: ${summary}${gridHint}`;
  } catch {
    return row.file_name;
  }
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function emptyMetrics(): GaiaAgentRunResult["metrics"] {
  return {
    stepCount: null,
    promptTokens: null,
    predictedTokens: null,
    toolErrors: null,
    wallClockMs: 0,
    timedOut: false,
    exitCode: null,
  };
}
