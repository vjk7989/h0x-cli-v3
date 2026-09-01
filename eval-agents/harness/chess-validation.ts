import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Chess, type Move, type Square } from "chess.js";

export interface ChessMoveSummary {
  san: string;
  uci: string;
  movedPiece: string;
  check: boolean;
  checkmate: boolean;
  scoreCentipawns: number;
  threatenedPieces: string[];
}

export interface ChessAnalysis {
  sideToMove: "b" | "w";
  legalMoveCount: number;
  tacticalCandidates: ChessMoveSummary[];
  bestCandidates: ChessMoveSummary[];
  checkingMoves: ChessMoveSummary[];
  checkmateMoves: ChessMoveSummary[];
}

const CHESS_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export function isChessImageQuestion(fileName: string, question: string): boolean {
  const lowerFile = fileName.toLowerCase();
  const hasImage = Array.from(CHESS_IMAGE_EXTENSIONS).some((ext) =>
    lowerFile.endsWith(ext),
  );
  if (!hasImage) return false;
  return /\b(chess|checkmate|mate|legal move|algebraic|fen|board|king|queen|rook|bishop|knight|pawn)\b/i.test(
    question,
  );
}

export function analyzeChessFen(fen: string): ChessMoveSummary[] {
  const game = new Chess(fen);
  return game.moves({ verbose: true }).map((move) => summarizeMove(fen, move));
}

export function buildFenFromPieceList(pieceList: string, sideToMove: "b" | "w"): string {
  const board = Array.from({ length: 8 }, () => Array<string | null>(8).fill(null));
  for (const { color, text } of splitPieceListByColor(pieceList)) {
    for (const match of text.matchAll(/\b([KQRBNP])\s*([a-h][1-8])\b/gi)) {
      const piece = match[1]!.toLowerCase();
      const square = match[2]!.toLowerCase();
      const file = square.charCodeAt(0) - "a".charCodeAt(0);
      const rank = Number(square[1]!);
      board[8 - rank]![file] = color === "w" ? piece.toUpperCase() : piece;
    }
  }

  const rows = board.map((rank) => {
    let empty = 0;
    let out = "";
    for (const piece of rank) {
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty > 0) {
        out += String(empty);
        empty = 0;
      }
      out += piece;
    }
    return out + (empty > 0 ? String(empty) : "");
  });
  const fen = `${rows.join("/")} ${sideToMove} - - 0 1`;
  new Chess(fen);
  return fen;
}

export function buildChessAnalysis(fen: string): ChessAnalysis {
  const game = new Chess(fen);
  const summaries = analyzeChessFen(fen);
  return {
    sideToMove: game.turn(),
    legalMoveCount: summaries.length,
    tacticalCandidates: buildTacticalCandidates(summaries),
    bestCandidates: rankMoves(summaries, game.turn()).slice(0, 5),
    checkingMoves: summaries.filter((move) => move.check),
    checkmateMoves: summaries.filter((move) => move.checkmate),
  };
}

export async function writeChessValidatorScript(workingDir: string): Promise<string> {
  const scriptName = "gaia-chess-validator.mjs";
  await writeFile(join(workingDir, scriptName), validatorScriptSource(), "utf8");
  return scriptName;
}

export function buildChessImageHint(fileName: string, scriptName: string): string {
  return [
    fileName,
    "Chess image guidance: inspect the board image once with `vision.describe`.",
    "If `vision.describe` returns empty, make at most one shorter `vision.describe` retry; do not load image-editing skills or process pixels.",
    "Use the printed board coordinates to determine orientation; do not assume white is at the bottom.",
    "Identify every piece square, side to move, and castling/en-passant availability, then form a FEN.",
    `If you have a piece list, avoid hand-writing FEN by running: node ${scriptName} --pieces "<piece list>" b.`,
    "Cross-check that every listed queen, rook, bishop, knight, pawn, and king appears exactly once in the validator's FEN.",
    `Validate candidate moves deterministically with: node ${scriptName} "<FEN>".`,
    "For puzzle wording like 'guarantees a win', prefer checkmateMoves first, then tacticalCandidates, then bestCandidates.",
    "Do not choose a checking move unless it is also a checkmate, tacticalCandidate, or top bestCandidate.",
    "If the validator says the move is not legal, fix the FEN or choose another legal candidate before FINAL ANSWER.",
  ].join(" ");
}

function splitPieceListByColor(pieceList: string): Array<{ color: "b" | "w"; text: string }> {
  const normalized = pieceList.replace(/\s+/g, " ");
  const whiteStart = normalized.search(/\bwhite\s*:/i);
  const blackStart = normalized.search(/\bblack\s*:/i);
  if (whiteStart === -1 && blackStart === -1) return [{ color: "w", text: normalized }];
  const sections: Array<{ color: "b" | "w"; text: string }> = [];
  if (whiteStart !== -1) {
    const end = blackStart !== -1 && blackStart > whiteStart ? blackStart : normalized.length;
    sections.push({ color: "w", text: normalized.slice(whiteStart, end) });
  }
  if (blackStart !== -1) {
    const end = whiteStart !== -1 && whiteStart > blackStart ? whiteStart : normalized.length;
    sections.push({ color: "b", text: normalized.slice(blackStart, end) });
  }
  return sections;
}

function rankMoves(
  moves: ChessMoveSummary[],
  sideToMove: "b" | "w",
): ChessMoveSummary[] {
  return moves
    .slice()
    .sort((a, b) =>
      sideToMove === "w"
        ? b.scoreCentipawns - a.scoreCentipawns
        : a.scoreCentipawns - b.scoreCentipawns,
    );
}

function buildTacticalCandidates(moves: ChessMoveSummary[]): ChessMoveSummary[] {
  const mates = moves.filter((move) => move.checkmate);
  if (mates.length > 0) return mates;
  return moves.filter(
    (move) =>
      move.movedPiece !== "p" && move.threatenedPieces.some((piece) => piece.startsWith("Q")),
  );
}

function summarizeMove(fen: string, move: Move): ChessMoveSummary {
  const game = new Chess(fen);
  const movedSide = game.turn();
  const played = game.move({ from: move.from, to: move.to, promotion: move.promotion });
  const threatenedPieces = findThreatenedPieces(game, movedSide);
  return {
    san: played.san,
    uci: `${played.from}${played.to}${played.promotion ?? ""}`,
    movedPiece: played.piece,
    check: game.inCheck(),
    checkmate: game.isCheckmate(),
    scoreCentipawns:
      searchPosition(game, 1, -Infinity, Infinity) +
      threatScoreCentipawns(threatenedPieces, movedSide),
    threatenedPieces,
  };
}

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

function searchPosition(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
): number {
  if (depth <= 0 || game.isGameOver()) return evaluatePosition(game);
  const maximizingWhite = game.turn() === "w";
  let best = maximizingWhite ? -Infinity : Infinity;
  for (const move of game.moves({ verbose: true })) {
    game.move({ from: move.from, to: move.to, promotion: move.promotion });
    const score = searchPosition(game, depth - 1, alpha, beta);
    game.undo();
    if (maximizingWhite) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, score);
    }
    if (beta <= alpha) break;
  }
  return best;
}

function evaluatePosition(game: Chess): number {
  if (game.isCheckmate()) return game.turn() === "w" ? -100_000 : 100_000;
  if (game.isDraw()) return 0;
  let score = 0;
  for (const rank of game.board()) {
    for (const piece of rank) {
      if (!piece) continue;
      const value = PIECE_VALUES[piece.type] ?? 0;
      score += piece.color === "w" ? value : -value;
    }
  }
  return score;
}

function threatScoreCentipawns(threatenedPieces: string[], movedSide: "b" | "w"): number {
  const score = threatenedPieces.reduce((total, entry) => {
    const piece = entry[0]?.toLowerCase() ?? "";
    return total + Math.round((PIECE_VALUES[piece] ?? 0) * 0.75);
  }, 0);
  return movedSide === "w" ? score : -score;
}

function findThreatenedPieces(game: Chess, attackerColor: "b" | "w"): string[] {
  const threatened: string[] = [];
  for (const rank of game.board()) {
    for (const piece of rank) {
      if (!piece || piece.color === attackerColor) continue;
      if (isSquareAttackedBy(game, piece.square, attackerColor)) {
        threatened.push(`${piece.type.toUpperCase()}${piece.square}`);
      }
    }
  }
  return threatened.sort((a, b) => {
    const valueDelta =
      (PIECE_VALUES[b[0]?.toLowerCase() ?? ""] ?? 0) -
      (PIECE_VALUES[a[0]?.toLowerCase() ?? ""] ?? 0);
    return valueDelta || a.localeCompare(b);
  });
}

function isSquareAttackedBy(game: Chess, square: string, attackerColor: "b" | "w"): boolean {
  for (const rank of game.board()) {
    for (const piece of rank) {
      if (!piece || piece.color !== attackerColor) continue;
      if (pieceAttacksSquare(game, piece.square, piece.type, attackerColor, square)) {
        return true;
      }
    }
  }
  return false;
}

function pieceAttacksSquare(
  game: Chess,
  from: string,
  type: string,
  color: "b" | "w",
  target: string,
): boolean {
  const [fileDelta, rankDelta] = squareDelta(from, target);
  const absFile = Math.abs(fileDelta);
  const absRank = Math.abs(rankDelta);
  if (type === "p") {
    const direction = color === "w" ? 1 : -1;
    return rankDelta === direction && absFile === 1;
  }
  if (type === "n") return (absFile === 1 && absRank === 2) || (absFile === 2 && absRank === 1);
  if (type === "k") return Math.max(absFile, absRank) === 1;
  if (type === "b") return absFile === absRank && isRayClear(game, from, target);
  if (type === "r") return (fileDelta === 0 || rankDelta === 0) && isRayClear(game, from, target);
  if (type === "q") {
    return (
      (absFile === absRank || fileDelta === 0 || rankDelta === 0) &&
      isRayClear(game, from, target)
    );
  }
  return false;
}

function squareDelta(from: string, target: string): [number, number] {
  return [
    target.charCodeAt(0) - from.charCodeAt(0),
    Number(target[1]) - Number(from[1]),
  ];
}

function isRayClear(game: Chess, from: string, target: string): boolean {
  const [fileDelta, rankDelta] = squareDelta(from, target);
  const fileStep = Math.sign(fileDelta);
  const rankStep = Math.sign(rankDelta);
  let file = from.charCodeAt(0) + fileStep;
  let rank = Number(from[1]) + rankStep;
  while (String.fromCharCode(file) + String(rank) !== target) {
    const square = `${String.fromCharCode(file)}${rank}` as Square;
    if (game.get(square)) return false;
    file += fileStep;
    rank += rankStep;
  }
  return true;
}

function validatorScriptSource(): string {
  return `import { Chess } from "chess.js";

let fen = process.argv.slice(2).join(" ").trim();
if (process.argv[2] === "--pieces") {
  const pieceList = process.argv[3] ?? "";
  const turn = process.argv[4] === "w" ? "w" : "b";
  fen = buildFenFromPieceList(pieceList, turn);
  console.error(\`fen: \${fen}\`);
}
if (!fen) {
  console.error("Usage: node gaia-chess-validator.mjs \\"<FEN>\\" OR node gaia-chess-validator.mjs --pieces \\"White: Kg1 ... Black: Kg8 ...\\" b");
  process.exit(2);
}

let game;
try {
  game = new Chess(fen);
} catch (error) {
  console.error(String(error?.message ?? error));
  process.exit(1);
}

const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
function buildFenFromPieceList(pieceList, sideToMove) {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const { color, text } of splitPieceListByColor(pieceList)) {
    for (const match of text.matchAll(/\\b([KQRBNP])\\s*([a-h][1-8])\\b/gi)) {
      const piece = match[1].toLowerCase();
      const square = match[2].toLowerCase();
      const file = square.charCodeAt(0) - "a".charCodeAt(0);
      const rank = Number(square[1]);
      board[8 - rank][file] = color === "w" ? piece.toUpperCase() : piece;
    }
  }
  const rows = board.map((rank) => {
    let empty = 0;
    let out = "";
    for (const piece of rank) {
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty > 0) {
        out += String(empty);
        empty = 0;
      }
      out += piece;
    }
    return out + (empty > 0 ? String(empty) : "");
  });
  const fen = \`\${rows.join("/")} \${sideToMove} - - 0 1\`;
  new Chess(fen);
  return fen;
}
function splitPieceListByColor(pieceList) {
  const normalized = pieceList.replace(/\\s+/g, " ");
  const whiteStart = normalized.search(/\\bwhite\\s*:/i);
  const blackStart = normalized.search(/\\bblack\\s*:/i);
  if (whiteStart === -1 && blackStart === -1) return [{ color: "w", text: normalized }];
  const sections = [];
  if (whiteStart !== -1) {
    const end = blackStart !== -1 && blackStart > whiteStart ? blackStart : normalized.length;
    sections.push({ color: "w", text: normalized.slice(whiteStart, end) });
  }
  if (blackStart !== -1) {
    const end = whiteStart !== -1 && whiteStart > blackStart ? whiteStart : normalized.length;
    sections.push({ color: "b", text: normalized.slice(blackStart, end) });
  }
  return sections;
}
function evaluatePosition(game) {
  if (game.isCheckmate()) return game.turn() === "w" ? -100000 : 100000;
  if (game.isDraw()) return 0;
  let score = 0;
  for (const rank of game.board()) {
    for (const piece of rank) {
      if (!piece) continue;
      score += (piece.color === "w" ? 1 : -1) * (pieceValues[piece.type] ?? 0);
    }
  }
  return score;
}
function threatScoreCentipawns(threatenedPieces, movedSide) {
  const score = threatenedPieces.reduce((total, entry) => {
    const piece = entry[0]?.toLowerCase() ?? "";
    return total + Math.round((pieceValues[piece] ?? 0) * 0.75);
  }, 0);
  return movedSide === "w" ? score : -score;
}
function findThreatenedPieces(game, attackerColor) {
  const threatened = [];
  for (const rank of game.board()) {
    for (const piece of rank) {
      if (!piece || piece.color === attackerColor) continue;
      if (isSquareAttackedBy(game, piece.square, attackerColor)) {
        threatened.push(\`\${piece.type.toUpperCase()}\${piece.square}\`);
      }
    }
  }
  return threatened.sort((a, b) => {
    const valueDelta =
      (pieceValues[b[0]?.toLowerCase() ?? ""] ?? 0) -
      (pieceValues[a[0]?.toLowerCase() ?? ""] ?? 0);
    return valueDelta || a.localeCompare(b);
  });
}
function isSquareAttackedBy(game, square, attackerColor) {
  for (const rank of game.board()) {
    for (const piece of rank) {
      if (!piece || piece.color !== attackerColor) continue;
      if (pieceAttacksSquare(game, piece.square, piece.type, attackerColor, square)) return true;
    }
  }
  return false;
}
function pieceAttacksSquare(game, from, type, color, target) {
  const [fileDelta, rankDelta] = squareDelta(from, target);
  const absFile = Math.abs(fileDelta);
  const absRank = Math.abs(rankDelta);
  if (type === "p") {
    const direction = color === "w" ? 1 : -1;
    return rankDelta === direction && absFile === 1;
  }
  if (type === "n") return (absFile === 1 && absRank === 2) || (absFile === 2 && absRank === 1);
  if (type === "k") return Math.max(absFile, absRank) === 1;
  if (type === "b") return absFile === absRank && isRayClear(game, from, target);
  if (type === "r") return (fileDelta === 0 || rankDelta === 0) && isRayClear(game, from, target);
  if (type === "q") return (absFile === absRank || fileDelta === 0 || rankDelta === 0) && isRayClear(game, from, target);
  return false;
}
function squareDelta(from, target) {
  return [
    target.charCodeAt(0) - from.charCodeAt(0),
    Number(target[1]) - Number(from[1]),
  ];
}
function isRayClear(game, from, target) {
  const [fileDelta, rankDelta] = squareDelta(from, target);
  const fileStep = Math.sign(fileDelta);
  const rankStep = Math.sign(rankDelta);
  let file = from.charCodeAt(0) + fileStep;
  let rank = Number(from[1]) + rankStep;
  while (String.fromCharCode(file) + String(rank) !== target) {
    if (game.get(String.fromCharCode(file) + String(rank))) return false;
    file += fileStep;
    rank += rankStep;
  }
  return true;
}
function searchPosition(game, depth, alpha, beta) {
  if (depth <= 0 || game.isGameOver()) return evaluatePosition(game);
  const maximizingWhite = game.turn() === "w";
  let best = maximizingWhite ? -Infinity : Infinity;
  for (const move of game.moves({ verbose: true })) {
    game.move({ from: move.from, to: move.to, promotion: move.promotion });
    const score = searchPosition(game, depth - 1, alpha, beta);
    game.undo();
    if (maximizingWhite) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, score);
    }
    if (beta <= alpha) break;
  }
  return best;
}

const summaries = game.moves({ verbose: true }).map((move) => {
  const probe = new Chess(fen);
  const played = probe.move({ from: move.from, to: move.to, promotion: move.promotion });
  const threatenedPieces = findThreatenedPieces(probe, game.turn());
  return {
    san: played.san,
    uci: \`\${played.from}\${played.to}\${played.promotion ?? ""}\`,
    movedPiece: played.piece,
    check: probe.inCheck(),
    checkmate: probe.isCheckmate(),
    scoreCentipawns:
      searchPosition(probe, 1, -Infinity, Infinity) +
      threatScoreCentipawns(threatenedPieces, game.turn()),
    threatenedPieces,
  };
});
const rankMoves = (moves) => moves
  .slice()
  .sort((a, b) => game.turn() === "w" ? b.scoreCentipawns - a.scoreCentipawns : a.scoreCentipawns - b.scoreCentipawns);
const bestCandidates = rankMoves(summaries).slice(0, 5);
const tacticalCandidates = buildTacticalCandidates(summaries);

console.log(JSON.stringify({
  sideToMove: game.turn(),
  legalMoveCount: summaries.length,
  tacticalCandidates,
  bestCandidates,
  checkmateMoves: summaries.filter((move) => move.checkmate),
  checkingMoves: summaries.filter((move) => move.check),
  legalMovesSan: summaries.map((move) => move.san).join(", "),
  warning: "This is deterministic lightweight validation. Prefer checkmateMoves first, then tacticalCandidates, then bestCandidates for best-move questions.",
}));

function buildTacticalCandidates(moves) {
  const mates = moves.filter((move) => move.checkmate);
  if (mates.length > 0) return mates;
  return moves.filter(
    (move) => move.movedPiece !== "p" && move.threatenedPieces.some((piece) => piece.startsWith("Q")),
  );
}
`;
}
