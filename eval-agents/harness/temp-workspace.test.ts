import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createGaiaWorkspace } from "./temp-workspace.js";
import type { GaiaRow } from "./gaia-types.js";

const createdRoots: string[] = [];

afterEach(() => {
  delete process.env.H0X_CLI_EVAL_TMP_DIR;
  delete process.env.ATOMIC_AGENT_EVAL_TMP_DIR;
  while (createdRoots.length > 0) {
    rmSync(createdRoots.pop()!, { recursive: true, force: true });
  }
});

describe("createGaiaWorkspace", () => {
  it("creates benchmark workspaces under the configured G-drive temp root", () => {
    const tempRoot = resolve("G:\\h0xi\\atomic-agent", "tmp", "gaia-workspace-tests");
    process.env.H0X_CLI_EVAL_TMP_DIR = tempRoot;
    createdRoots.push(tempRoot);

    const row: GaiaRow = {
      task_id: "task:with/slashes",
      Question: "Fixture question?",
      Level: 1,
      "Final answer": "Fixture answer",
      file_name: "fixture.txt",
      file_path: "fixture.txt",
      fixture_file_text: "fixture body",
    };

    const workspace = createGaiaWorkspace(row.task_id, row);
    createdRoots.push(workspace.workingDir);

    expect(workspace.workingDir.startsWith(tempRoot)).toBe(true);
    expect(workspace.stateDir.startsWith(tempRoot)).toBe(true);
    expect(workspace.workingDir).not.toMatch(/[/:\\]task:with[\\/]slashes-/);
    expect(existsSync(join(workspace.workingDir, "fixture.txt"))).toBe(true);

    workspace.cleanup();
  });

  it("lets h0x temp env override the legacy temp env", () => {
    const h0xRoot = resolve("G:\\h0xi\\atomic-agent", "tmp", "gaia-h0x-temp");
    const legacyRoot = resolve("G:\\h0xi\\atomic-agent", "tmp", "gaia-legacy-temp");
    process.env.H0X_CLI_EVAL_TMP_DIR = h0xRoot;
    process.env.ATOMIC_AGENT_EVAL_TMP_DIR = legacyRoot;
    createdRoots.push(h0xRoot, legacyRoot);

    const row: GaiaRow = {
      task_id: "precedence",
      Question: "Fixture question?",
      Level: 1,
      "Final answer": "Fixture answer",
      file_name: "",
      file_path: "",
    };

    const workspace = createGaiaWorkspace(row.task_id, row);

    expect(workspace.workingDir.startsWith(h0xRoot)).toBe(true);
    expect(workspace.workingDir.startsWith(legacyRoot)).toBe(false);

    workspace.cleanup();
  });
});
