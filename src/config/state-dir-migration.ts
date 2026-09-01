import { cpSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { emitConfigNotice } from "./config-file.js";

export const LEGACY_STATE_DIR_DEFAULT = "~/.atomic-agent";
export const STATE_DIR_MIGRATION_MARKER = "migration.json";

export function maybeCopyLegacyStateDir(args: {
  legacyStateDir: string;
  nextStateDir: string;
}): void {
  if (args.legacyStateDir === args.nextStateDir) return;
  if (!existsSync(args.legacyStateDir)) return;
  if (existsSync(args.nextStateDir)) return;

  try {
    cpSync(args.legacyStateDir, args.nextStateDir, {
      recursive: true,
      force: false,
      errorOnExist: false,
      preserveTimestamps: true,
    });
    writeFileSync(
      join(args.nextStateDir, STATE_DIR_MIGRATION_MARKER),
      `${JSON.stringify(
        {
          source: "h0x-cli state-dir migration",
          mode: "copy",
          from: args.legacyStateDir,
          to: args.nextStateDir,
        },
        null,
        2,
      )}\n`,
      { flag: "wx", mode: 0o600 },
    );
    emitConfigNotice(
      `[h0x-cli] copied legacy state from ${args.legacyStateDir} to ${args.nextStateDir}; legacy data was left in place`,
    );
  } catch (err) {
    emitConfigNotice(
      `[h0x-cli] could not copy legacy state from ${args.legacyStateDir} to ${args.nextStateDir}: ${
        err instanceof Error ? err.message : String(err)
      }; legacy data was left in place`,
    );
  }
}
