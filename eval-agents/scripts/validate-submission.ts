#!/usr/bin/env node
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";

import { loadGaiaRows } from "../harness/load-gaia-rows.js";
import { validateGaiaSubmissionJsonl } from "../harness/gaia-submission.js";

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseSplit(value: string): "validation" | "test" {
  if (value === "validation" || value === "test") return value;
  throw new Error(`unsupported split ${value}`);
}

function main() {
  const path = readArg("file");
  if (!path) throw new Error("usage: npm run eval:agents:validate-submission -- --file <submission.jsonl>");
  if (!existsSync(path)) throw new Error(`submission file not found: ${path}`);

  const split = parseSplit(readArg("split") ?? process.env.H0X_CLI_GAIA_SPLIT ?? "test");
  const source = (readArg("source") ?? process.env.H0X_CLI_GAIA_SOURCE ?? "hf") as
    | "hf"
    | "fixtures"
    | "auto";
  const expectedRows = loadGaiaRows({ source, split });
  const result = validateGaiaSubmissionJsonl(readFileSync(path, "utf8"), { split, expectedRows });
  if (!result.ok) {
    for (const issue of result.errors) {
      console.error(`[${issue.code}] ${issue.message}`);
    }
    process.exit(1);
  }
  console.log(`submission OK for ${split}: ${expectedRows.length} rows`);
}

main();
