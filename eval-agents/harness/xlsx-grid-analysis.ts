import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";

export async function buildXlsxGridAnalysis(
  sourcePath: string,
  question: string,
): Promise<string | null> {
  if (!isGridMovementQuestion(question)) return null;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await readStandaloneArrayBuffer(sourcePath));

  const lines: string[] = [];
  for (const sheet of workbook.worksheets) {
    const grid = readGrid(sheet);
    if (!grid.start || !grid.end) continue;

    const selectedFill = selectRequestedFill(grid.fills, question);
    const avoidFills = selectAvoidedFills(grid.fills, question);
    const adjacentPath = findPath(grid, (cell) => {
      if (cell.ref === grid.start || cell.ref === grid.end) return true;
      if (!cell.fill) return false;
      if (avoidFills.has(cell.fill)) return false;
      if (selectedFill) return cell.fill === selectedFill;
      return true;
    });

    const exactTwoStepPath = findPath(
      grid,
      (cell) => {
        if (cell.ref === grid.start || cell.ref === grid.end) return true;
        if (!cell.fill) return false;
        return !avoidFills.has(cell.fill);
      },
      2,
    );

    const parts = [`sheet ${sheet.name}`, `START ${grid.start}`, `END ${grid.end}`];
    if (selectedFill) parts.push(`requested fill ${selectedFill}`);
    if (avoidFills.size > 0) parts.push(`avoided fills ${Array.from(avoidFills).join(",")}`);
    if (adjacentPath) parts.push(`adjacent path ${formatPath(adjacentPath)}`);
    if (exactTwoStepPath) parts.push(`exact two-cell path ${formatPath(exactTwoStepPath)}`);
    else if (/\btwo\b|\b2\b/i.test(question)) parts.push("exact two-cell path not found");
    const turnLanding = inferTurnLanding(grid, question, {
      adjacentPath,
      exactStridePath: exactTwoStepPath,
      stride: 2,
    });
    if (turnLanding) parts.push(turnLanding);
    lines.push(parts.join("; "));
  }

  if (lines.length === 0) return null;
  return `Precomputed workbook path candidates: ${lines.join(" | ")}`;
}

interface GridCell {
  ref: string;
  row: number;
  col: number;
  fill: string | null;
  value: string;
}

interface Grid {
  cells: Map<string, GridCell>;
  start: string | null;
  end: string | null;
  fills: Map<string, GridCell[]>;
}

function readGrid(sheet: ExcelJS.Worksheet): Grid {
  const cells = new Map<string, GridCell>();
  const fills = new Map<string, GridCell[]>();
  let start: string | null = null;
  let end: string | null = null;
  const bounds = inferWorksheetBounds(sheet);

  for (let row = 1; row <= bounds.rows; row += 1) {
    for (let col = 1; col <= bounds.cols; col += 1) {
      const cell = sheet.getRow(row).getCell(col);
      const ref = `${columnName(col)}${row}`;
      const value = renderValue(cell.value).trim();
      const fill = getFillArgb(cell);
      const gridCell: GridCell = { ref, row, col, fill, value };
      cells.set(ref, gridCell);
      if (value.toUpperCase() === "START") start = ref;
      if (value.toUpperCase() === "END") end = ref;
      if (fill) {
        const group = fills.get(fill) ?? [];
        group.push(gridCell);
        fills.set(fill, group);
      }
    }
  }

  return { cells, start, end, fills };
}

function inferWorksheetBounds(sheet: ExcelJS.Worksheet): { rows: number; cols: number } {
  let cols = sheet.columnCount;
  sheet.eachRow({ includeEmpty: true }, (row) => {
    row.eachCell({ includeEmpty: true }, (_cell, col) => {
      cols = Math.max(cols, col);
    });
  });
  return { rows: sheet.rowCount, cols };
}

function findPath(
  grid: Grid,
  isPassable: (cell: GridCell) => boolean,
  stride = 1,
): string[] | null {
  if (!grid.start || !grid.end) return null;
  const queue: string[] = [grid.start];
  const previous = new Map<string, string | null>([[grid.start, null]]);

  for (let index = 0; index < queue.length; index += 1) {
    const currentRef = queue[index];
    if (!currentRef) continue;
    if (currentRef === grid.end) return backtrack(previous, currentRef);
    const current = grid.cells.get(currentRef);
    if (!current) continue;
    for (const next of neighbors(grid, current, stride)) {
      if (previous.has(next.ref)) continue;
      if (!isPassable(next)) continue;
      previous.set(next.ref, currentRef);
      queue.push(next.ref);
    }
  }

  return null;
}

function neighbors(grid: Grid, cell: GridCell, stride: number): GridCell[] {
  const offsets = [
    [0, stride],
    [stride, 0],
    [0, -stride],
    [-stride, 0],
  ] as const;
  return offsets
    .map(([rowDelta, colDelta]) => grid.cells.get(`${columnName(cell.col + colDelta)}${cell.row + rowDelta}`))
    .filter((next): next is GridCell => Boolean(next));
}

function selectRequestedFill(fills: Map<string, GridCell[]>, question: string): string | null {
  if (/\byellow\b/i.test(question)) return findColor(fills, "yellow");
  if (/\bgreen\b/i.test(question)) return findColor(fills, "green");
  if (/\bpink\b/i.test(question)) return findColor(fills, "pink");
  return null;
}

function selectAvoidedFills(fills: Map<string, GridCell[]>, question: string): Set<string> {
  const avoided = new Set<string>();
  if (/\bavoid\b.*\bblue\b|\bblue\b.*\bavoid\b/i.test(question)) {
    const blue = findColor(fills, "blue");
    if (blue) avoided.add(blue);
  }
  return avoided;
}

function findColor(fills: Map<string, GridCell[]>, color: "blue" | "green" | "pink" | "yellow"): string | null {
  const matches = Array.from(fills.keys()).filter((fill) => colorDistance(fill, color) < 170);
  matches.sort((a, b) => (fills.get(b)?.length ?? 0) - (fills.get(a)?.length ?? 0));
  return matches[0] ?? null;
}

function colorDistance(argb: string, target: "blue" | "green" | "pink" | "yellow"): number {
  const rgb = argb.slice(-6);
  const r = Number.parseInt(rgb.slice(0, 2), 16);
  const g = Number.parseInt(rgb.slice(2, 4), 16);
  const b = Number.parseInt(rgb.slice(4, 6), 16);
  const targets = {
    blue: [0, 128, 255],
    green: [128, 208, 80],
    pink: [244, 120, 167],
    yellow: [255, 204, 0],
  } as const;
  const [tr, tg, tb] = targets[target];
  return Math.hypot(r - tr, g - tg, b - tb);
}

function inferTurnLanding(
  grid: Grid,
  question: string,
  paths: { adjacentPath: string[] | null; exactStridePath: string[] | null; stride: number },
): string | null {
  const match = /\b(?:after|on)\s+the\s+(\w+)\s+turn\b/i.exec(question);
  if (!match?.[1]) return null;
  const turn = parseOrdinal(match[1]);
  if (turn === null || turn < 0) return null;

  const strideMentioned = new RegExp(`\\b${paths.stride}\\b|\\btwo\\b`, "i").test(question);
  const landing = paths.exactStridePath && turn < paths.exactStridePath.length
    ? paths.exactStridePath[turn]
    : strideMentioned && paths.adjacentPath && turn * paths.stride < paths.adjacentPath.length
      ? paths.adjacentPath[turn * paths.stride]
      : paths.adjacentPath && turn < paths.adjacentPath.length
        ? paths.adjacentPath[turn]
        : null;
  if (!landing) return null;
  const cell = grid.cells.get(landing);
  const fill = cell?.fill ? cell.fill.slice(-6).toUpperCase() : null;
  return fill ? `turn ${turn} landing ${landing} fill ${fill}` : `turn ${turn} landing ${landing}`;
}

function parseOrdinal(value: string): number | null {
  const lower = value.toLowerCase();
  const words: Record<string, number> = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    ninth: 9,
    tenth: 10,
    eleventh: 11,
    twelfth: 12,
  };
  const wordValue = words[lower];
  if (wordValue !== undefined) return wordValue;
  const parsed = Number.parseInt(lower.replace(/\D/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function backtrack(previous: Map<string, string | null>, end: string): string[] {
  const path: string[] = [];
  let current: string | null = end;
  while (current) {
    path.push(current);
    current = previous.get(current) ?? null;
  }
  return path.reverse();
}

function formatPath(path: string[]): string {
  return path.join(" -> ");
}

function isGridMovementQuestion(question: string): boolean {
  return /\b(start|end)\b/i.test(question) && /\b(move|path|turn|grid|map|cell)\b/i.test(question);
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const rich = value as { richText?: Array<{ text?: string }> };
    if (Array.isArray(rich.richText)) return rich.richText.map((part) => part.text ?? "").join("");
    const text = value as { text?: string };
    if (typeof text.text === "string") return text.text;
  }
  return String(value);
}

function getFillArgb(cell: ExcelJS.Cell): string | null {
  const fill = cell.fill;
  if (!fill || fill.type !== "pattern") return null;
  const argb = fill.fgColor?.argb ?? fill.bgColor?.argb;
  if (!argb || argb === "00000000") return null;
  return argb;
}

function columnName(col: number): string {
  if (col < 1) return "";
  let n = col;
  let name = "";
  while (n > 0) {
    n -= 1;
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26);
  }
  return name;
}

async function readStandaloneArrayBuffer(path: string): Promise<ArrayBuffer> {
  const data = await readFile(path);
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy.buffer;
}
