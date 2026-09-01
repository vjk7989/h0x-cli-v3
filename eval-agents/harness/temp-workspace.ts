import { mkdtempSync, mkdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { GaiaRow } from "./gaia-types.js";
import { resolveAttachmentPath } from "./load-gaia-rows.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_EVAL_TMP_ROOT = resolve(HERE, "..", "..", "tmp", "eval-agents");

export interface GaiaWorkspace {
  workingDir: string;
  stateDir: string;
  cleanup: () => void;
}

export function createGaiaWorkspace(
  taskId: string,
  row: GaiaRow,
  split: "validation" | "test" = "validation",
): GaiaWorkspace {
  const tempRoot =
    process.env.H0X_CLI_EVAL_TMP_DIR ??
    process.env.ATOMIC_AGENT_EVAL_TMP_DIR ??
    DEFAULT_EVAL_TMP_ROOT;
  mkdirSync(tempRoot, { recursive: true });

  const base = mkdtempSync(join(tempRoot, `eval-agents-${sanitizePathPart(taskId)}-`));
  const workingDir = join(base, "cwd");
  const stateDir = join(base, "state");
  mkdirSync(workingDir, { recursive: true });
  mkdirSync(stateDir, { recursive: true });

  if (row.fixture_file_text && row.file_name) {
    writeFileSync(join(workingDir, row.file_name), row.fixture_file_text, "utf8");
  } else {
    const attachment = resolveAttachmentPath(row, split);
    if (attachment && row.file_name) {
      copyFileSync(attachment, join(workingDir, row.file_name));
    }
  }

  return {
    workingDir,
    stateDir,
    cleanup: () => {
      try {
        rmSync(base, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    },
  };
}

function sanitizePathPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, "_");
}
