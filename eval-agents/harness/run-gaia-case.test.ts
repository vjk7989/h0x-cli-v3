import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { buildAttachmentHint, runGaiaCase } from "./run-gaia-case.js";
import type { AgentAdapter } from "./agent-adapter.js";
import type { GaiaRow } from "./gaia-types.js";

describe("runGaiaCase", () => {
  it("classifies tool-call shaped final text as invalid final format", async () => {
    const row: GaiaRow = {
      task_id: "synthetic-invalid-final-format",
      Question: "Synthetic question",
      Level: 1,
      "Final answer": "No",
      file_name: "",
      file_path: "",
    };
    const adapter: AgentAdapter = {
      id: "h0x-cli",
      label: "h0x-cli",
      probeRequirements: () => [],
      runQuestion: async () => ({
        rawReply:
          '```json [{"tool":"os.shell.run","args":{"cmd":"python","args":["solve.py"]}}] ```',
        exitCode: 0,
        timedOut: false,
        error: null,
        metrics: {
          stepCount: 6,
          promptTokens: 100,
          predictedTokens: 0,
          toolErrors: 1,
          wallClockMs: 10,
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
      maxSteps: 8,
      timeoutMs: 1000,
    });

    expect(result.error).toBe("invalid_final_format");
    expect(result.correct).toBe(false);
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
});
