#!/usr/bin/env node
/**
 * Download GAIA validation or test split + attachments into eval-agents/datasets/gaia/hf/.
 *
 * Requires HF_TOKEN (or HUGGINGFACE_HUB_TOKEN) and accepting the dataset
 * license on https://huggingface.co/datasets/gaia-benchmark/GAIA
 *
 * Usage:
 *   npm run eval:agents:datasets
 *   node eval-agents/scripts/download-gaia.mjs --split test --force
 */

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { parquetReadObjects, asyncBufferFromFile } from "hyparquet";

import { loadEnv, makeLog, REPO_ROOT } from "./_lib.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const DEST = resolve(HERE, "..", "datasets", "gaia", "hf");

const log = makeLog("download-gaia");

function parseArgs(argv) {
  const splitIndex = argv.indexOf("--split");
  const split = splitIndex >= 0 ? argv[splitIndex + 1] : "validation";
  if (!["validation", "test", "all"].includes(split)) {
    throw new Error(`unsupported --split ${split}`);
  }
  return { force: argv.includes("--force"), split };
}

/**
 * Resolve a HF token from env, or fall back to the credential cached by
 * `huggingface-cli login` (~/.cache/huggingface/token). Returns null when
 * neither is available.
 */
function resolveHfToken() {
  const fromEnv = process.env.HF_TOKEN ?? process.env.HUGGINGFACE_HUB_TOKEN;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();
  const cached = join(homedir(), ".cache", "huggingface", "token");
  if (existsSync(cached)) {
    const value = readFileSync(cached, "utf8").trim();
    if (value.length > 0) return value;
  }
  return null;
}

/**
 * Resolve the HF CLI binary, preferring the modern `hf` over the
 * deprecated `huggingface-cli`. Uses a login shell so pyenv / conda
 * shims that are not on the non-interactive PATH still resolve.
 */
function resolveHfCli() {
  for (const bin of ["hf", "huggingface-cli"]) {
    if (process.platform === "win32") {
      const r = spawnSync("where.exe", [bin], { encoding: "utf8" });
      const out = (r.stdout ?? "").trim();
      if (r.status === 0 && out.length > 0) return out.split(/\r?\n/)[0];
    }
    const r = spawnSync("sh", ["-lc", `command -v ${bin}`], { encoding: "utf8" });
    const out = (r.stdout ?? "").trim();
    if (r.status === 0 && out.length > 0) return out.split(/\r?\n/)[0];
  }
  return null;
}

/**
 * The current GAIA HF repo ships metadata as Parquet (metadata.parquet +
 * per-level shards), not the legacy metadata.jsonl. Convert the full
 * Parquet into the metadata.jsonl shape the harness loader expects.
 */
async function convertParquetToJsonl(split) {
  const splitDir = join(DEST, "2023", split);
  const meta = join(splitDir, "metadata.jsonl");
  const metaParquet = join(splitDir, "metadata.parquet");
  if (!existsSync(metaParquet)) {
    log(`metadata.parquet missing at ${metaParquet} — cannot build metadata.jsonl`);
    process.exit(2);
  }
  const file = await asyncBufferFromFile(metaParquet);
  const rows = await parquetReadObjects({ file });
  const lines = rows.map((r) =>
    JSON.stringify({
      task_id: r.task_id,
      Question: r.Question,
      Level: Number(r.Level),
      "Final answer": r["Final answer"] ?? "",
      file_name: r.file_name ?? "",
      file_path: r.file_path ?? "",
    }),
  );
  writeFileSync(meta, `${lines.join("\n")}\n`, "utf8");
  const byLevel = {};
  for (const r of rows) byLevel[Number(r.Level)] = (byLevel[Number(r.Level)] ?? 0) + 1;
  log(`wrote ${rows.length} rows → ${meta} (by level: ${JSON.stringify(byLevel)})`);
}

async function downloadSplit({ split, force, hfBin, token }) {
  const splitDir = join(DEST, "2023", split);
  const meta = join(splitDir, "metadata.jsonl");
  if (!force && existsSync(meta)) {
    const mb = (statSync(meta).size / 1024 / 1024).toFixed(2);
    log(`already present: ${meta} (${mb} MB) — use --force to re-download`);
    return;
  }

  log(`downloading gaia-benchmark/GAIA ${split} split → ${DEST}`);
  const r = spawnSync(
    hfBin,
    [
      "download",
      "gaia-benchmark/GAIA",
      "--repo-type",
      "dataset",
      "--include",
      `2023/${split}/*`,
      "--local-dir",
      DEST,
    ],
    {
      cwd: REPO_ROOT,
      stdio: "inherit",
      env: token
        ? { ...process.env, HF_TOKEN: token, HUGGINGFACE_HUB_TOKEN: token }
        : process.env,
    },
  );
  if (r.status !== 0) {
    log("download failed — accept the license on HF and retry");
    process.exit(r.status ?? 1);
  }

  await convertParquetToJsonl(split);
}

async function main() {
  loadEnv();
  const { force, split } = parseArgs(process.argv.slice(2));
  const token = resolveHfToken();

  const hfBin = resolveHfCli();
  if (!hfBin) {
    log("hf / huggingface-cli not found — install: pip install -U huggingface_hub");
    process.exit(2);
  }
  log(`using HF CLI: ${hfBin}`);
  if (!token) {
    log("no env/cached token file found — using HF CLI's saved login if available");
  }

  const splits = split === "all" ? ["validation", "test"] : [split];
  for (const selected of splits) {
    await downloadSplit({ split: selected, force, hfBin, token });
  }
  log("done.");
}

main().catch((err) => {
  log(`fatal: ${err?.stack ?? err}`);
  process.exit(1);
});
