#!/usr/bin/env node
// Dispatch to smoke or HF matrix based on ATOMIC_AGENT_GAIA_SOURCE.

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnv, readEvalEnv } from "./_lib.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));

loadEnv();
const source = readEvalEnv("H0X_CLI_GAIA_SOURCE", "ATOMIC_AGENT_GAIA_SOURCE") ?? "fixtures";
const split = readEvalEnv("H0X_CLI_GAIA_SPLIT", "ATOMIC_AGENT_GAIA_SPLIT") ?? "validation";
const script = source !== "hf" ? "run-smoke.mjs" : split === "test" ? "run-test.mjs" : "run-validation.mjs";
const path = resolve(HERE, script);

const r = spawnSync(process.execPath, [path, ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(r.status ?? 1);
