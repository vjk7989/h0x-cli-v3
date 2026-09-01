import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import type { AgentAdapter } from "./agent-adapter.js";
import type { GaiaRow, GaiaAgentRunResult } from "./gaia-types.js";
import { buildGaiaUserPrompt, extractFinalAnswer } from "./extract-answer.js";
import { questionScorer } from "./score-gaia.js";
import { createGaiaWorkspace } from "./temp-workspace.js";
import { preserveTraceFiles } from "./preserve-traces.js";
import { buildXlsxGridAnalysis } from "./xlsx-grid-analysis.js";
import {
  buildChessImageHint,
  isChessImageQuestion,
  writeChessValidatorScript,
} from "./chess-validation.js";

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
    const chessImage = isChessImageQuestion(opts.row.file_name, opts.row.Question);
    const prompt = buildGaiaUserPrompt(opts.row.Question, attachmentHint);
    let raw = await opts.adapter.runQuestion({
      row: opts.row,
      workingDir: workspace.workingDir,
      stateDir: workspace.stateDir,
      prompt,
      maxSteps: opts.maxSteps ?? 30,
      timeoutMs: opts.timeoutMs ?? 600_000,
      chatUrl: opts.chatUrl,
      embedUrl: opts.embedUrl,
    });
    if (shouldRetryForFinalFormat(raw.rawReply, raw.error)) {
      const retry = await opts.adapter.runQuestion({
        row: opts.row,
        workingDir: workspace.workingDir,
        stateDir: workspace.stateDir,
        prompt: buildFinalFormatRetryPrompt(prompt),
        maxSteps: Math.min(opts.maxSteps ?? 30, 6),
        timeoutMs: opts.timeoutMs ?? 600_000,
        chatUrl: opts.chatUrl,
        embedUrl: opts.embedUrl,
      });
      raw = {
        ...retry,
        metrics: {
          ...retry.metrics,
          formatRetryAttempted: true,
        },
      };
    }
    const metrics = {
      ...raw.metrics,
      attachmentEvidenceProvided: attachmentHint !== null,
      attachmentToolUsed: attachmentHint !== null
        ? await detectAttachmentToolUse(workspace.stateDir)
        : false,
      imageEvidenceProvided: isImageAttachment(opts.row.file_name),
      imageToolUsed: isImageAttachment(opts.row.file_name)
        ? await detectToolUse(workspace.stateDir, (tool) => tool === "vision.describe")
        : false,
      chessValidationUsed: chessImage
        ? await detectChessValidationUse(workspace.stateDir)
        : false,
    };

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
      metrics,
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

function shouldRetryForFinalFormat(rawReply: string, error: string | null): boolean {
  if (error) return false;
  const trimmed = rawReply.trim();
  if (!trimmed) return true;
  const extracted = extractFinalAnswer(rawReply);
  return isInvalidFinalFormat(rawReply, extracted);
}

function buildFinalFormatRetryPrompt(originalPrompt: string): string {
  return collapseWhitespace(
    [
      originalPrompt,
      "Your previous response was missing the required final-answer format.",
      "Do not use correctness feedback or assume any gold answer.",
      "Use the same evidence rules and reply with exactly one final line: FINAL ANSWER: <your answer>",
    ].join(" "),
  );
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

async function detectAttachmentToolUse(stateDir: string): Promise<boolean> {
  return detectToolUse(stateDir, isAttachmentEvidenceTool);
}

async function detectToolUse(
  stateDir: string,
  predicate: (tool: string, event: Record<string, unknown>) => boolean,
): Promise<boolean> {
  const traceDir = join(stateDir, "traces");
  let entries: string[];
  try {
    entries = await readdir(traceDir);
  } catch {
    return false;
  }

  for (const entry of entries) {
    if (!entry.endsWith(".ndjson")) continue;
    const text = await readFile(join(traceDir, entry), "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as Record<string, unknown> & {
          type?: unknown;
          tool?: unknown;
        };
        if (
          event.type === "tool_invocation" &&
          typeof event.tool === "string" &&
          predicate(event.tool, event)
        ) {
          return true;
        }
      } catch {
        // Ignore malformed trace lines; traces are best-effort metadata.
      }
    }
  }
  return false;
}

function isAttachmentEvidenceTool(tool: string): boolean {
  return tool === "os.fs.read_document" || tool === "os.fs.read" || tool === "os.shell.run";
}

function isImageAttachment(fileName: string): boolean {
  return /\.(png|jpe?g|webp|gif)$/i.test(fileName);
}

function detectChessValidationUse(stateDir: string): Promise<boolean> {
  return detectToolUse(stateDir, (tool, event) => {
    if (tool !== "os.shell.run") return false;
    const args = event.args;
    return JSON.stringify(args ?? {}).includes("gaia-chess-validator.mjs");
  });
}

export async function buildAttachmentHint(workingDir: string, row: GaiaRow): Promise<string | null> {
  if (!row.file_name) return null;
  if (isChessImageQuestion(row.file_name, row.Question)) {
    const scriptName = await writeChessValidatorScript(workingDir);
    return buildChessImageHint(row.file_name, scriptName);
  }
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
