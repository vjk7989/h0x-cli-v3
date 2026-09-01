import { execFile } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import {
  analyzeChessFen,
  buildChessAnalysis,
  buildFenFromPieceList,
  buildChessImageHint,
  isChessImageQuestion,
  writeChessValidatorScript,
} from "./chess-validation.js";

const execFileAsync = promisify(execFile);

describe("chess validation helpers", () => {
  it("gates chess guidance to image-backed chess questions", () => {
    expect(isChessImageQuestion("board.png", "What is the best chess move?")).toBe(
      true,
    );
    expect(isChessImageQuestion("photo.png", "What color is the car?")).toBe(false);
    expect(isChessImageQuestion("", "What is checkmate in one?")).toBe(false);
    expect(isChessImageQuestion("board.txt", "What is the best chess move?")).toBe(
      false,
    );
  });

  it("builds a chess hint without task ids or answers", () => {
    const hint = buildChessImageHint("board.png", "gaia-chess-validator.mjs");
    expect(hint).toContain("vision.describe");
    expect(hint).toContain("orientation");
    expect(hint).toContain("FEN");
    expect(hint).toContain("bestCandidates");
    expect(hint).toContain("--pieces");
    expect(hint).toContain("at most one shorter");
    expect(hint).toContain("do not load image-editing skills");
    expect(hint).toContain("node gaia-chess-validator.mjs");
    expect(hint).not.toContain("cca530fc");
  });

  it("builds FEN from a color-grouped piece list without dropping queens", () => {
    const fen = buildFenFromPieceList(
      "White: Kg1 Qh5 Re3 Bd3 Bc3 Pa3 Pf2 Pg2 Ph3 Black: Kg8 Qb3 Rd8 Be6 Nd4 Pa7 Pb7 Pf7 Pg7 Ph6",
      "b",
    );
    expect(fen).toBe("3r2k1/pp3pp1/4b2p/7Q/3n4/PqBBR2P/5PP1/6K1 b - - 0 1");
  });

  it("returns SAN and UCI moves for a valid FEN", () => {
    const moves = analyzeChessFen("7k/6Q1/7K/8/8/8/8/8 w - - 0 1");
    expect(moves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          san: "Qf8#",
          uci: "g7f8",
          checkmate: true,
          scoreCentipawns: expect.any(Number),
        }),
      ]),
    );
  });

  it("marks checking and mating moves", () => {
    const mates = analyzeChessFen("7k/6Q1/7K/8/8/8/8/8 w - - 0 1").filter(
      (move) => move.checkmate,
    );
    expect(mates.length).toBeGreaterThan(0);
    expect(mates.every((move) => move.check)).toBe(true);
  });

  it("ranks legal candidate moves for best-move questions", () => {
    const analysis = buildChessAnalysis(
      "3r2k1/pp3pp1/4b2p/7Q/3n4/PqBBR2P/5PP1/6K1 b - - 0 1",
    );
    expect(analysis.sideToMove).toBe("b");
    expect(analysis.bestCandidates).toHaveLength(5);
    expect(analysis.bestCandidates[0]).toEqual(
      expect.objectContaining({
        threatenedPieces: expect.arrayContaining(["Qh5"]),
      }),
    );
    expect(analysis.bestCandidates.every((move) => typeof move.scoreCentipawns === "number")).toBe(
      true,
    );
    expect(analysis.tacticalCandidates[0]).toEqual(
      expect.objectContaining({
        san: "Rd5",
        movedPiece: "r",
        threatenedPieces: expect.arrayContaining(["Qh5"]),
      }),
    );
  });

  it("throws a clean error for invalid FEN", () => {
    expect(() => analyzeChessFen("not a fen")).toThrow(/Invalid FEN/i);
  });

  it("writes an executable validator script into the eval workspace", async () => {
    const dir = resolve("G:\\h0xi\\atomic-agent", "tmp", "gaia-chess-tests");
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    try {
      const scriptName = await writeChessValidatorScript(dir);
      const script = await readFile(join(dir, scriptName), "utf8");
      expect(scriptName).toBe("gaia-chess-validator.mjs");
      expect(script).toContain("tacticalCandidates");
      expect(script).toContain("bestCandidates");
      expect(script).toContain("legalMovesSan");
      expect(script).toContain("checkmateMoves");
      expect(script).not.toContain("FINAL ANSWER");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runs the generated validator script with compact parseable output", async () => {
    const dir = resolve("G:\\h0xi\\atomic-agent", "tmp", "gaia-chess-script-tests");
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    try {
      const scriptName = await writeChessValidatorScript(dir);
      const { stdout } = await execFileAsync(
        process.execPath,
        [
          join(dir, scriptName),
          "--pieces",
          "White: Kh6 Qg7 Black: Kh8",
          "w",
        ],
        {
          env: {
            ...process.env,
          },
        },
      );
      const parsed = JSON.parse(stdout) as {
        tacticalCandidates: unknown[];
        bestCandidates: unknown[];
        legalMovesSan: string;
      };
      expect(parsed.tacticalCandidates.length).toBeGreaterThan(0);
      expect(parsed.bestCandidates.length).toBeGreaterThan(0);
      expect(parsed.legalMovesSan).toContain("Qf8#");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
