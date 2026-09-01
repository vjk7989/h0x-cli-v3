import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { xlsxExtractor } from "./xlsx-extractor.js";

const FIXTURE_PATH = resolve(
  fileURLToPath(new URL("../../test-fixtures/sample.xlsx", import.meta.url)),
);

describe("xlsxExtractor", () => {
  it("renders both sheets with headers and pipe-separated rows", async () => {
    const data = await readFile(FIXTURE_PATH);
    const result = await xlsxExtractor({ data, sourcePath: FIXTURE_PATH });
    expect(result.format).toBe("xlsx");
    expect(result.sheetCount).toBe(2);
    expect(result.pagesExtracted).toEqual([1, 2]);
    expect(result.text).toContain("## Sheet: Revenue");
    expect(result.text).toContain("Quarter | Amount | Notes");
    expect(result.text).toContain("Q1 | 1200 | Good");
    expect(result.text).toContain("Q2 | 1500 | Better");
    expect(result.text).toContain("## Sheet: Notes");
    expect(result.text).toContain("Blessing | Complete");
    expect(result.warnings).toEqual([]);
  });

  it("filters to a named sheet via `sheets`", async () => {
    const data = await readFile(FIXTURE_PATH);
    const result = await xlsxExtractor({
      data,
      sourcePath: FIXTURE_PATH,
      sheets: ["Notes"],
    });
    expect(result.pagesExtracted).toEqual([2]);
    expect(result.text).toContain("## Sheet: Notes");
    expect(result.text).not.toContain("Revenue");
  });

  it("filters to a sheet by 1-indexed position", async () => {
    const data = await readFile(FIXTURE_PATH);
    const result = await xlsxExtractor({
      data,
      sourcePath: FIXTURE_PATH,
      sheets: [1],
    });
    expect(result.pagesExtracted).toEqual([1]);
    expect(result.text).toContain("Revenue");
    expect(result.text).not.toContain("## Sheet: Notes");
  });

  it("warns when a requested sheet is missing", async () => {
    const data = await readFile(FIXTURE_PATH);
    const result = await xlsxExtractor({
      data,
      sourcePath: FIXTURE_PATH,
      sheets: ["NonExistent", 99],
    });
    expect(result.warnings).toContain('sheet "NonExistent" not found');
    expect(result.warnings).toContain("sheet index 99 is out of range");
    expect(result.text).toBe("");
  });

  it("omits sheet headers when pageSeparators=false", async () => {
    const data = await readFile(FIXTURE_PATH);
    const result = await xlsxExtractor({
      data,
      sourcePath: FIXTURE_PATH,
      pageSeparators: false,
    });
    expect(result.text).not.toContain("## Sheet:");
    expect(result.text).toContain("Q1 | 1200 | Good");
  });

  it("renders styled empty xlsx cells as compact fill markers", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Maze");
    sheet.getCell("A1").value = "START";
    sheet.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0099FF" },
    };
    sheet.getCell("B1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFF00" },
    };
    sheet.getCell("C2").value = "END";
    sheet.getCell("C2").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF92D050" },
    };
    const data = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await xlsxExtractor({ data, sourcePath: "styled.xlsx" });

    expect(result.text).toContain("START [fill=FF0099FF]");
    expect(result.text).toContain("[fill=FFFFFF00]");
    expect(result.text).toContain("END [fill=FF92D050]");
    expect(result.text).toContain("Values: A1=START [fill=FF0099FF]; C2=END [fill=FF92D050]");
    expect(result.text).toContain("Cell fills:");
    expect(result.text).toContain("FF0099FF=A1");
    expect(result.text).toContain("FFFFFF00=B1");
    expect(result.text).toContain("FF92D050=C2");
  });

  it("summarizes styled grid landmarks and fill groups for deterministic path reasoning", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Path Grid");
    sheet.getCell("A1").value = "START";
    sheet.getCell("D3").value = "END";

    for (const ref of ["B1", "C1", "C2", "C3"]) {
      sheet.getCell(ref).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFCC00" },
      };
    }
    for (const ref of ["B2", "B3"]) {
      sheet.getCell(ref).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF808080" },
      };
    }
    const data = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await xlsxExtractor({ data, sourcePath: "path-grid.xlsx" });

    expect(result.text).toContain("Grid landmarks: START=A1; END=D3");
    expect(result.text).toContain("Fill groups: FFFFCC00=B1,C1,C2,C3; FF808080=B2,B3");
    expect(result.text).toContain("Grid bounds: A1:D3");
  });

  it("infers bounds from styled-only cells when workbook dimensions omit columns", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Styled Only");
    sheet.getCell("A2").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF00FF00" },
    };
    sheet.getCell("D4").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF00FF00" },
    };
    const data = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await xlsxExtractor({ data, sourcePath: "styled-only.xlsx" });

    expect(result.text).toContain("Grid bounds: A1:D4");
    expect(result.text).toContain("Fill groups: FF00FF00=A2,D4");
    expect(result.text).toContain("[fill=FF00FF00]");
  });
});
