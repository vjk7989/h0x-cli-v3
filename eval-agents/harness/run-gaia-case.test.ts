import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { buildAttachmentHint, runGaiaCase } from "./run-gaia-case.js";
import type { AgentAdapter } from "./agent-adapter.js";
import type { GaiaRow } from "./gaia-types.js";

describe("runGaiaCase", () => {
  it("marks attachment evidence metadata and passes evidence before the question", async () => {
    const row: GaiaRow = {
      task_id: "synthetic-attachment-metadata",
      Question: "Use the attached file to answer.",
      Level: 1,
      "Final answer": "ok",
      file_name: "notes.txt",
      file_path: "notes.txt",
      fixture_file_text: "evidence",
    };
    let seenPrompt = "";
    const adapter: AgentAdapter = {
      id: "h0x-cli",
      label: "h0x-cli",
      probeRequirements: () => [],
      runQuestion: async (ctx) => {
        seenPrompt = ctx.prompt;
        await mkdir(join(ctx.stateDir, "traces"), { recursive: true });
        await writeFile(
          join(ctx.stateDir, "traces", "s-test.ndjson"),
          `${JSON.stringify({ type: "tool_invocation", tool: "os.fs.read", status: "ok" })}\n`,
          "utf8",
        );
        return {
          rawReply: "FINAL ANSWER: ok",
          exitCode: 0,
          timedOut: false,
          error: null,
          metrics: {
            stepCount: 1,
            promptTokens: 10,
            predictedTokens: 1,
            toolErrors: 0,
            wallClockMs: 5,
            timedOut: false,
            exitCode: 0,
          },
        };
      },
    };

    const result = await runGaiaCase({
      adapter,
      row,
      chatUrl: "",
      embedUrl: null,
      maxSteps: 2,
      timeoutMs: 1000,
    });

    expect(result.metrics.attachmentEvidenceProvided).toBe(true);
    expect(result.metrics.attachmentToolUsed).toBe(true);
    expect(seenPrompt.indexOf("Attachment evidence is required")).toBeLessThan(
      seenPrompt.indexOf("Question:"),
    );
  });

  it("does not retry wrong but well-formed final answers", async () => {
    const row: GaiaRow = {
      task_id: "synthetic-no-correctness-retry",
      Question: "Synthetic question",
      Level: 1,
      "Final answer": "right",
      file_name: "",
      file_path: "",
    };
    let calls = 0;
    const adapter: AgentAdapter = {
      id: "h0x-cli",
      label: "h0x-cli",
      probeRequirements: () => [],
      runQuestion: async () => {
        calls += 1;
        return {
          rawReply: "FINAL ANSWER: wrong",
          exitCode: 0,
          timedOut: false,
          error: null,
          metrics: {
            stepCount: 1,
            promptTokens: 10,
            predictedTokens: 1,
            toolErrors: 0,
            wallClockMs: 5,
            timedOut: false,
            exitCode: 0,
          },
        };
      },
    };

    const result = await runGaiaCase({
      adapter,
      row,
      chatUrl: "",
      embedUrl: null,
      maxSteps: 2,
      timeoutMs: 1000,
    });

    expect(calls).toBe(1);
    expect(result.correct).toBe(false);
    expect(result.error).toBeNull();
  });

  it("classifies tool-call shaped final text as invalid final format", async () => {
    const row: GaiaRow = {
      task_id: "synthetic-invalid-final-format",
      Question: "Synthetic question",
      Level: 1,
      "Final answer": "No",
      file_name: "",
      file_path: "",
    };
    let calls = 0;
    const adapter: AgentAdapter = {
      id: "h0x-cli",
      label: "h0x-cli",
      probeRequirements: () => [],
      runQuestion: async (ctx) => {
        calls += 1;
        if (calls === 2) {
          expect(ctx.prompt).toMatch(/previous response was missing/i);
          expect(ctx.prompt).toMatch(/do not use correctness feedback/i);
        }
        return {
          rawReply: calls === 1
            ? '```json [{"tool":"os.shell.run","args":{"cmd":"python","args":["solve.py"]}}] ```'
            : "FINAL ANSWER: No",
          exitCode: 0,
          timedOut: false,
          error: null,
          metrics: {
            stepCount: 6,
            promptTokens: 100,
            predictedTokens: 0,
            toolErrors: calls === 1 ? 1 : 0,
            wallClockMs: 10,
            timedOut: false,
            exitCode: 0,
          },
        };
      },
    };

    const result = await runGaiaCase({
      adapter,
      row,
      chatUrl: "",
      embedUrl: null,
      maxSteps: 8,
      timeoutMs: 1000,
    });

    expect(calls).toBe(2);
    expect(result.error).toBeNull();
    expect(result.correct).toBe(true);
    expect(result.metrics.formatRetryAttempted).toBe(true);
  });

  it("retries once when the reply is blank", async () => {
    const row: GaiaRow = {
      task_id: "synthetic-blank-retry",
      Question: "Synthetic question",
      Level: 1,
      "Final answer": "recovered",
      file_name: "",
      file_path: "",
    };
    let calls = 0;
    const adapter: AgentAdapter = {
      id: "h0x-cli",
      label: "h0x-cli",
      probeRequirements: () => [],
      runQuestion: async () => {
        calls += 1;
        return {
          rawReply: calls === 1 ? "" : "FINAL ANSWER: recovered",
          exitCode: 0,
          timedOut: false,
          error: null,
          metrics: {
            stepCount: 1,
            promptTokens: 10,
            predictedTokens: 1,
            toolErrors: 0,
            wallClockMs: 5,
            timedOut: false,
            exitCode: 0,
          },
        };
      },
    };

    const result = await runGaiaCase({
      adapter,
      row,
      chatUrl: "",
      embedUrl: null,
      maxSteps: 8,
      timeoutMs: 1000,
    });

    expect(calls).toBe(2);
    expect(result.correct).toBe(true);
    expect(result.metrics.formatRetryAttempted).toBe(true);
  });

  it("pre-extracts xlsx attachment content into the prompt hint", async () => {
    const dir = resolve("G:\\h0xi\\atomic-agent", "tmp", "gaia-run-case-tests");
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Grid");
      sheet.getCell("A1").value = "START";
      sheet.getCell("B1").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF478A7" },
      };
      await writeFile(join(dir, "grid.xlsx"), Buffer.from(await workbook.xlsx.writeBuffer()));

      const hint = await buildAttachmentHint(dir, {
        task_id: "synthetic-xlsx",
        Question: "Synthetic question",
        Level: 1,
        "Final answer": "Synthetic answer",
        file_name: "grid.xlsx",
        file_path: "grid.xlsx",
      });

      expect(hint).toContain("grid.xlsx");
      expect(hint).toContain("Pre-extracted workbook summary");
      expect(hint).toContain("START");
      expect(hint).toContain("[fill=FFF478A7]");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("adds chess guidance only for chess image attachments", async () => {
    const dir = resolve("G:\\h0xi\\atomic-agent", "tmp", "gaia-run-case-tests");
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    try {
      const hint = await buildAttachmentHint(dir, {
        task_id: "synthetic-chess-image",
        Question: "What is the best chess move in algebraic notation?",
        Level: 1,
        "Final answer": "Synthetic answer",
        file_name: "board.png",
        file_path: "board.png",
      });

      expect(hint).toContain("Chess image guidance");
      expect(hint).toContain("FEN");
      expect(hint).toContain("gaia-chess-validator.mjs");
      expect(hint).not.toContain("Synthetic answer");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does not add chess guidance for non-chess image attachments", async () => {
    const hint = await buildAttachmentHint("G:\\h0xi\\atomic-agent\\tmp", {
      task_id: "synthetic-non-chess-image",
      Question: "What color is the object in this photo?",
      Level: 1,
      "Final answer": "Synthetic answer",
      file_name: "photo.png",
      file_path: "photo.png",
    });

    expect(hint).toBe("photo.png");
  });

  it("marks image and chess usage metadata from traces", async () => {
    const row: GaiaRow = {
      task_id: "synthetic-chess-metadata",
      Question: "What is the best chess move?",
      Level: 1,
      "Final answer": "ok",
      file_name: "board.png",
      file_path: "board.png",
      fixture_file_text: "not-real-image",
    };
    const adapter: AgentAdapter = {
      id: "h0x-cli",
      label: "h0x-cli",
      probeRequirements: () => [],
      runQuestion: async (ctx) => {
        await mkdir(join(ctx.stateDir, "traces"), { recursive: true });
        await writeFile(
          join(ctx.stateDir, "traces", "s-test.ndjson"),
          [
            JSON.stringify({ type: "tool_invocation", tool: "vision.describe", status: "ok" }),
            JSON.stringify({
              type: "tool_invocation",
              tool: "os.shell.run",
              args: { cmd: "node", args: ["gaia-chess-validator.mjs", "fen"] },
              status: "ok",
            }),
          ].join("\n"),
          "utf8",
        );
        return {
          rawReply: "FINAL ANSWER: ok",
          exitCode: 0,
          timedOut: false,
          error: null,
          metrics: {
            stepCount: 2,
            promptTokens: 20,
            predictedTokens: 1,
            toolErrors: 0,
            wallClockMs: 5,
            timedOut: false,
            exitCode: 0,
          },
        };
      },
    };

    const result = await runGaiaCase({
      adapter,
      row,
      chatUrl: "",
      embedUrl: null,
      maxSteps: 2,
      timeoutMs: 1000,
    });

    expect(result.metrics.imageEvidenceProvided).toBe(true);
    expect(result.metrics.imageToolUsed).toBe(true);
    expect(result.metrics.chessValidationUsed).toBe(true);
  });

  it("marks web search and fetch usage metadata from traces", async () => {
    const row: GaiaRow = {
      task_id: "synthetic-web-metadata",
      Question: "What public page confirms this synthetic fact?",
      Level: 1,
      "Final answer": "ok",
      file_name: "",
      file_path: "",
    };
    const adapter: AgentAdapter = {
      id: "h0x-cli",
      label: "h0x-cli",
      probeRequirements: () => [],
      runQuestion: async (ctx) => {
        await mkdir(join(ctx.stateDir, "traces"), { recursive: true });
        await writeFile(
          join(ctx.stateDir, "traces", "s-test.ndjson"),
          [
            JSON.stringify({ type: "tool_invocation", tool: "os.web.search", status: "ok" }),
            JSON.stringify({ type: "tool_invocation", tool: "os.web.fetch", status: "ok" }),
          ].join("\n"),
          "utf8",
        );
        return {
          rawReply: "FINAL ANSWER: ok",
          exitCode: 0,
          timedOut: false,
          error: null,
          metrics: {
            stepCount: 2,
            promptTokens: 20,
            predictedTokens: 1,
            toolErrors: 0,
            wallClockMs: 5,
            timedOut: false,
            exitCode: 0,
          },
        };
      },
    };

    const result = await runGaiaCase({
      adapter,
      row,
      chatUrl: "",
      embedUrl: null,
      maxSteps: 2,
      timeoutMs: 1000,
    });
    const metrics = result.metrics as typeof result.metrics & {
      webSearchUsed?: boolean;
      webFetchUsed?: boolean;
      searchOnlyFinalAnswer?: boolean;
    };

    expect(metrics.webSearchUsed).toBe(true);
    expect(metrics.webFetchUsed).toBe(true);
    expect(metrics.searchOnlyFinalAnswer).toBe(false);
  });

  it("marks search-only final answers when no page fetch was traced", async () => {
    const row: GaiaRow = {
      task_id: "synthetic-search-only-metadata",
      Question: "What public source has this synthetic answer?",
      Level: 1,
      "Final answer": "ok",
      file_name: "",
      file_path: "",
    };
    const adapter: AgentAdapter = {
      id: "h0x-cli",
      label: "h0x-cli",
      probeRequirements: () => [],
      runQuestion: async (ctx) => {
        await mkdir(join(ctx.stateDir, "traces"), { recursive: true });
        await writeFile(
          join(ctx.stateDir, "traces", "s-test.ndjson"),
          `${JSON.stringify({ type: "tool_invocation", tool: "os.web.search", status: "ok" })}\n`,
          "utf8",
        );
        return {
          rawReply: "FINAL ANSWER: ok",
          exitCode: 0,
          timedOut: false,
          error: null,
          metrics: {
            stepCount: 1,
            promptTokens: 20,
            predictedTokens: 1,
            toolErrors: 0,
            wallClockMs: 5,
            timedOut: false,
            exitCode: 0,
          },
        };
      },
    };

    const result = await runGaiaCase({
      adapter,
      row,
      chatUrl: "",
      embedUrl: null,
      maxSteps: 2,
      timeoutMs: 1000,
    });
    const metrics = result.metrics as typeof result.metrics & {
      webSearchUsed?: boolean;
      webFetchUsed?: boolean;
      searchOnlyFinalAnswer?: boolean;
    };

    expect(metrics.webSearchUsed).toBe(true);
    expect(metrics.webFetchUsed).toBe(false);
    expect(metrics.searchOnlyFinalAnswer).toBe(true);
  });

  it("marks deterministic computation usage from shell traces", async () => {
    const row: GaiaRow = {
      task_id: "synthetic-deterministic-computation",
      Question: "Sort these dates and compute the difference.",
      Level: 1,
      "Final answer": "ok",
      file_name: "",
      file_path: "",
    };
    const adapter: AgentAdapter = {
      id: "h0x-cli",
      label: "h0x-cli",
      probeRequirements: () => [],
      runQuestion: async (ctx) => {
        await mkdir(join(ctx.stateDir, "traces"), { recursive: true });
        await writeFile(
          join(ctx.stateDir, "traces", "s-test.ndjson"),
          `${JSON.stringify({
            type: "tool_invocation",
            tool: "os.shell.run",
            args: { cmd: "node", args: ["-e", "console.log(new Date('2026-01-02') > new Date('2026-01-01'))"] },
            status: "ok",
          })}\n`,
          "utf8",
        );
        return {
          rawReply: "FINAL ANSWER: ok",
          exitCode: 0,
          timedOut: false,
          error: null,
          metrics: {
            stepCount: 1,
            promptTokens: 20,
            predictedTokens: 1,
            toolErrors: 0,
            wallClockMs: 5,
            timedOut: false,
            exitCode: 0,
          },
        };
      },
    };

    const result = await runGaiaCase({
      adapter,
      row,
      chatUrl: "",
      embedUrl: null,
      maxSteps: 2,
      timeoutMs: 1000,
    });
    const metrics = result.metrics as typeof result.metrics & {
      deterministicComputationUsed?: boolean;
    };

    expect(metrics.deterministicComputationUsed).toBe(true);
  });

  it("does not mark image/chess flags for xlsx-only rows", async () => {
    const dir = resolve("G:\\h0xi\\atomic-agent", "tmp", "gaia-run-case-tests");
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.addWorksheet("Sheet").getCell("A1").value = "hello";
      await writeFile(join(dir, "plain.xlsx"), Buffer.from(await workbook.xlsx.writeBuffer()));

      const row: GaiaRow = {
        task_id: "synthetic-xlsx-metadata",
        Question: "Use the spreadsheet.",
        Level: 1,
        "Final answer": "ok",
        file_name: "plain.xlsx",
        file_path: "plain.xlsx",
      };
      const adapter: AgentAdapter = {
        id: "h0x-cli",
        label: "h0x-cli",
        probeRequirements: () => [],
        runQuestion: async () => ({
          rawReply: "FINAL ANSWER: ok",
          exitCode: 0,
          timedOut: false,
          error: null,
          metrics: {
            stepCount: 1,
            promptTokens: 10,
            predictedTokens: 1,
            toolErrors: 0,
            wallClockMs: 5,
            timedOut: false,
            exitCode: 0,
          },
        }),
      };

      const result = await runGaiaCase({
        adapter,
        row,
        chatUrl: "",
        embedUrl: null,
        maxSteps: 2,
        timeoutMs: 1000,
      });

      expect(result.metrics.imageEvidenceProvided).toBe(false);
      expect(result.metrics.imageToolUsed).toBe(false);
      expect(result.metrics.chessValidationUsed).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("adds deterministic xlsx path candidates when the question describes grid movement rules", async () => {
    const dir = resolve("G:\\h0xi\\atomic-agent", "tmp", "gaia-run-case-tests");
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Maze");
      sheet.getCell("A1").value = "START";
      sheet.getCell("D3").value = "END";
      for (const ref of ["B1", "C1", "C2", "C3"]) {
        sheet.getCell(ref).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFCC00" },
        };
      }
      await writeFile(join(dir, "maze.xlsx"), Buffer.from(await workbook.xlsx.writeBuffer()));

      const hint = await buildAttachmentHint(dir, {
        task_id: "synthetic-xlsx-path",
        Question:
          "In the attached spreadsheet, start at START and move only horizontally or vertically through cells with the same yellow fill until END. What cells are on the path?",
        Level: 1,
        "Final answer": "Synthetic answer",
        file_name: "maze.xlsx",
        file_path: "maze.xlsx",
      });

      expect(hint).toContain("Precomputed workbook path candidates");
      expect(hint).toContain("START A1");
      expect(hint).toContain("END D3");
      expect(hint).toContain("A1 -> B1 -> C1 -> C2 -> C3 -> D3");
      expect(hint).not.toContain("Synthetic answer");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("adds the landing-cell fill code for turn-based xlsx grid questions", async () => {
    const dir = resolve("G:\\h0xi\\atomic-agent", "tmp", "gaia-run-case-tests");
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Maze");
      sheet.getCell("A1").value = "START";
      sheet.getCell("A7").value = "END";
      for (const ref of ["A3", "A5", "A7"]) {
        sheet.getCell(ref).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ref === "A5" ? "FF12AB34" : "FFFFCC00" },
        };
      }
      await writeFile(join(dir, "maze-turn.xlsx"), Buffer.from(await workbook.xlsx.writeBuffer()));

      const hint = await buildAttachmentHint(dir, {
        task_id: "synthetic-xlsx-turn-landing",
        Question:
          "You start on START and move two cells per turn toward END. On the second turn, what is the 6-digit hex code of the color of the cell where you land?",
        Level: 1,
        "Final answer": "Synthetic answer",
        file_name: "maze-turn.xlsx",
        file_path: "maze-turn.xlsx",
      });

      expect(hint).toContain("exact two-cell path A1 -> A3 -> A5 -> A7");
      expect(hint).toContain("turn 2 landing A5 fill 12AB34");
      expect(hint).not.toContain("Synthetic answer");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("derives two-cell turn landings from an adjacent path when direct stride jumps are blocked", async () => {
    const dir = resolve("G:\\h0xi\\atomic-agent", "tmp", "gaia-run-case-tests");
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Maze");
      sheet.getCell("A1").value = "START";
      sheet.getCell("A6").value = "END";
      for (const ref of ["A2", "A3", "A4", "A5", "A6"]) {
        sheet.getCell(ref).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ref === "A5" ? "FFABCDEF" : "FFFFFF00" },
        };
      }
      await writeFile(join(dir, "maze-adjacent.xlsx"), Buffer.from(await workbook.xlsx.writeBuffer()));

      const hint = await buildAttachmentHint(dir, {
        task_id: "synthetic-xlsx-adjacent-turn-landing",
        Question:
          "You start on START and move two cells per turn toward END. On the second turn, what is the 6-digit hex code of the color of the cell where you land?",
        Level: 1,
        "Final answer": "Synthetic answer",
        file_name: "maze-adjacent.xlsx",
        file_path: "maze-adjacent.xlsx",
      });

      expect(hint).toContain("adjacent path A1 -> A2 -> A3 -> A4 -> A5 -> A6");
      expect(hint).toContain("exact two-cell path not found");
      expect(hint).toContain("turn 2 landing A5 fill ABCDEF");
      expect(hint).not.toContain("Synthetic answer");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
