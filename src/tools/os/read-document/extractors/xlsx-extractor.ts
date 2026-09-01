import type { Extractor } from "./extractor-types.js";

/**
 * XLSX extractor backed by exceljs. Produces a compact pipe-separated
 * rendering per sheet:
 *
 *     ## Sheet: Revenue
 *     Quarter | Amount | Notes
 *     Q1 | 1200 | Good
 *     Q2 | 1500 | Better
 *
 * - Trailing empty cells are stripped so "Q1 | 1200 |  |  | " becomes "Q1 | 1200".
 * - Fully empty rows are skipped (common padding in exported spreadsheets).
 * - Formula cells render as their cached calculated value (Excel keeps one
 *   in the file), falling back to the raw formula string if none is cached.
 * - Dates are serialised as ISO strings so the LLM can parse them.
 *
 * Legacy .xls (BIFF) is NOT supported by exceljs; the dispatcher only
 * routes `.xlsx` here. For .xls the user should convert via Excel /
 * LibreOffice first.
 */
export const xlsxExtractor: Extractor = async (input) => {
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(toArrayBuffer(input.data));

  const warnings: string[] = [];
  const allSheets = workbook.worksheets;
  const selection = selectSheets(allSheets, input.sheets, warnings);
  const showHeader = input.pageSeparators !== false;

  const parts: string[] = [];
  for (const ws of selection) {
    if (showHeader) parts.push(`## Sheet: ${ws.name}`);
    const styleSummary = renderStyleSummary(ws);
    if (styleSummary.length > 0) parts.push(styleSummary);
    const rowsText = renderSheet(ws);
    if (rowsText.length > 0) parts.push(rowsText);
  }

  return {
    format: "xlsx",
    text: parts.join("\n\n").trim(),
    sheetCount: allSheets.length,
    pagesExtracted: selection.map((s) => allSheets.indexOf(s) + 1),
    warnings,
  };
};

interface WorksheetLike {
  name: string;
  id: number;
  rowCount?: number;
  columnCount?: number;
  getRow?: (row: number) => RowLike;
  eachRow(
    options: { includeEmpty: boolean },
    cb: (row: RowLike, rowNumber: number) => void,
  ): void;
}

interface RowLike {
  getCell: (col: number) => CellLike;
  eachCell: (opts: { includeEmpty: boolean }, cb: (cell: CellLike, col: number) => void) => void;
}

interface CellLike {
  value: unknown;
  result?: unknown;
  formula?: string;
  type?: number;
  fill?: unknown;
}

function selectSheets(
  all: WorksheetLike[],
  requested: readonly (string | number)[] | undefined,
  warnings: string[],
): WorksheetLike[] {
  if (!requested || requested.length === 0) return all;
  const picked: WorksheetLike[] = [];
  for (const entry of requested) {
    if (typeof entry === "number") {
      const ws = all[entry - 1];
      if (ws) picked.push(ws);
      else warnings.push(`sheet index ${entry} is out of range`);
    } else {
      const ws = all.find((s) => s.name === entry);
      if (ws) picked.push(ws);
      else warnings.push(`sheet ${JSON.stringify(entry)} not found`);
    }
  }
  return picked;
}

function renderSheet(ws: WorksheetLike): string {
  const rows: string[] = [];
  const includeStyledCells = hasStyledCells(ws);
  visitRows(ws, includeStyledCells, (cells) => {
    while (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
    if (cells.length === 0) return;
    rows.push(cells.join(" | "));
  });
  return rows.join("\n");
}

function renderStyleSummary(ws: WorksheetLike): string {
  const bounds = inferWorksheetBounds(ws);
  if (!bounds || !ws.getRow) return "";
  const values: string[] = [];
  const fills = new Map<string, string[]>();
  const landmarks = new Map<string, string>();

  for (let rowNumber = 1; rowNumber <= bounds.rows; rowNumber += 1) {
    const row = ws.getRow(rowNumber);
    for (let col = 1; col <= bounds.cols; col += 1) {
      const cell = row.getCell(col);
      const ref = `${columnName(col)}${rowNumber}`;
      const text = renderCellValue(cell);
      const fill = getFillArgb(cell);
      if (text) values.push(`${ref}=${text}${fill ? ` [fill=${fill}]` : ""}`);
      const normalizedText = text.trim().toUpperCase();
      if (normalizedText === "START" || normalizedText === "END") {
        landmarks.set(normalizedText, ref);
      }
      if (fill) {
        const refs = fills.get(fill) ?? [];
        refs.push(ref);
        fills.set(fill, refs);
      }
    }
  }

  if (values.length === 0 && fills.size === 0) return "";

  const lines: string[] = [];
  lines.push(`Grid bounds: A1:${columnName(bounds.cols)}${bounds.rows}`);
  if (landmarks.size > 0) {
    const ordered = ["START", "END"]
      .filter((name) => landmarks.has(name))
      .map((name) => `${name}=${landmarks.get(name)}`);
    lines.push(`Grid landmarks: ${ordered.join("; ")}`);
  }
  if (values.length > 0) lines.push(`Values: ${values.join("; ")}`);
  if (fills.size > 0) {
    const fillGroups = Array.from(fills.entries())
      .map(([fill, refs]) => `${fill}=${refs.join(",")}`)
      .join("; ");
    lines.push(`Fill groups: ${fillGroups}`);
    lines.push(`Cell fills: ${fillGroups}`);
  }
  return lines.join("\n");
}

function visitRows(
  ws: WorksheetLike,
  includeStyledCells: boolean,
  cb: (cells: string[]) => void,
): void {
  const bounds = inferWorksheetBounds(ws);
  if (includeStyledCells && bounds && ws.getRow) {
    for (let rowNumber = 1; rowNumber <= bounds.rows; rowNumber += 1) {
      const row = ws.getRow(rowNumber);
      const cells: string[] = [];
      for (let col = 1; col <= bounds.cols; col += 1) {
        cells.push(renderCell(row.getCell(col), includeStyledCells));
      }
      cb(cells);
    }
    return;
  }

  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      cells.push(renderCell(cell, includeStyledCells));
    });
    cb(cells);
  });
}

function hasStyledCells(ws: WorksheetLike): boolean {
  let found = false;
  ws.eachRow({ includeEmpty: true }, (row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      if (getFillArgb(cell)) found = true;
    });
  });
  return found;
}

function inferWorksheetBounds(ws: WorksheetLike): { rows: number; cols: number } | null {
  const rows = ws.rowCount ?? 0;
  let cols = ws.columnCount ?? 0;
  ws.eachRow({ includeEmpty: true }, (row) => {
    row.eachCell({ includeEmpty: true }, (_cell, col) => {
      cols = Math.max(cols, col);
    });
  });
  if (rows <= 0 || cols <= 0) return null;
  return { rows, cols };
}

function renderCell(cell: CellLike, includeFill = false): string {
  const text = renderCellValue(cell);
  if (!includeFill) return text;
  const fill = getFillArgb(cell);
  if (!fill) return text;
  return text.length > 0 ? `${text} [fill=${fill}]` : `[fill=${fill}]`;
}

function renderCellValue(cell: CellLike): string {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object") {
    // exceljs boxes formulas / rich text / hyperlinks / errors into objects.
    const asFormula = value as { result?: unknown; formula?: string };
    if ("result" in asFormula && asFormula.result !== undefined) {
      return renderCellValue({ value: asFormula.result });
    }
    if ("formula" in asFormula && typeof asFormula.formula === "string") {
      return `=${asFormula.formula}`;
    }
    const asRichText = value as { richText?: Array<{ text?: string }> };
    if (Array.isArray(asRichText.richText)) {
      return asRichText.richText.map((r) => r.text ?? "").join("");
    }
    const asHyperlink = value as { text?: string; hyperlink?: string };
    if (typeof asHyperlink.text === "string") return asHyperlink.text;
  }
  return String(value);
}

function getFillArgb(cell: CellLike): string | null {
  const fill = cell.fill;
  if (!fill || typeof fill !== "object") return null;
  const pattern = fill as { fgColor?: { argb?: string }; bgColor?: { argb?: string } };
  const argb = pattern.fgColor?.argb ?? pattern.bgColor?.argb;
  if (!argb || argb === "00000000") return null;
  return argb;
}

function columnName(col: number): string {
  let n = col;
  let name = "";
  while (n > 0) {
    n -= 1;
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26);
  }
  return name;
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  // Node Buffers are views over shared memory; slice off a standalone
  // ArrayBuffer so exceljs's zip reader can own it safely.
  const copy = new Uint8Array(buf.byteLength);
  copy.set(buf);
  return copy.buffer;
}

type ExcelJsModule = { Workbook: new () => { xlsx: { load(data: ArrayBuffer): Promise<unknown> }; worksheets: WorksheetLike[] } };

let excelJsModule: ExcelJsModule | undefined;
async function loadExcelJs(): Promise<ExcelJsModule> {
  if (!excelJsModule) {
    const mod = (await import("exceljs")) as
      | ExcelJsModule
      | { default: ExcelJsModule };
    excelJsModule = "default" in mod ? mod.default : mod;
  }
  return excelJsModule;
}
