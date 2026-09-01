#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  buildGaiaSubmissionJsonl,
  validateGaiaSubmissionJsonl,
} from "../harness/gaia-submission.js";
import type { GaiaAgentRunResult, GaiaRow } from "../harness/gaia-types.js";
import { loadGaiaRows } from "../harness/load-gaia-rows.js";

interface Args {
  matrix: string;
  out: string;
  agent: string;
  split: "validation" | "test";
  source: "hf" | "fixtures" | "auto";
}

function parseArgs(argv: readonly string[]): Args {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`missing value for --${key}`);
    }
    values.set(key, value);
    i += 1;
  }

  const matrix = values.get("matrix");
  if (!matrix) throw new Error("usage: npm run eval:agents:export-submission -- --matrix <matrix.jsonl>");
  const split = parseSplit(values.get("split") ?? process.env.H0X_CLI_GAIA_SPLIT ?? "test");
  const out = values.get("out") ?? resolve(matrix, "..", "submission.jsonl");
  return {
    matrix,
    out,
    split,
    agent: values.get("agent") ?? "h0x-cli",
    source: parseSource(values.get("source") ?? process.env.H0X_CLI_GAIA_SOURCE ?? "hf"),
  };
}

function parseSplit(value: string): "validation" | "test" {
  if (value === "validation" || value === "test") return value;
  throw new Error(`unsupported split ${value}`);
}

function parseSource(value: string): "hf" | "fixtures" | "auto" {
  if (value === "hf" || value === "fixtures" || value === "auto") return value;
  throw new Error(`unsupported source ${value}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.matrix)) throw new Error(`matrix file not found: ${args.matrix}`);

  const rows = readFileSync(args.matrix, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((record) => {
      const result = record.result as { agentId?: string; skipped?: boolean } | undefined;
      return result?.agentId === args.agent && result.skipped !== true;
    })
    .map((record) => ({
      row: record.row as GaiaRow,
      result: record.result as GaiaAgentRunResult,
    }));
  const jsonl = buildGaiaSubmissionJsonl(rows);
  const expectedRows = loadGaiaRows({ source: args.source, split: args.split });
  const result = validateGaiaSubmissionJsonl(jsonl, { split: args.split, expectedRows });
  if (!result.ok) {
    const body = result.errors.map((issue) => `- ${issue.message}`).join("\n");
    throw new Error(`submission is not complete for ${args.split}:\n${body}`);
  }

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, jsonl, "utf8");
  console.log(`wrote ${rows.length} rows -> ${args.out}`);
}

main();
