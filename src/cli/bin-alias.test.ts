import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `atag` is the short alias for the CLI. It has to be created by every
 * install channel, and each channel owns its own file — so dropping it from
 * one while editing another is an easy mistake. These assertions are the
 * guard against a partially-installed alias.
 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(relative: string): string {
  return readFileSync(resolve(repoRoot, relative), "utf8");
}

describe("CLI package and compatibility aliases", () => {
  it("publishes h0x-cli with the canonical command and intentional compatibility entrypoints", () => {
    const manifest = JSON.parse(read("package.json")) as {
      name: string;
      homepage?: string;
      repository?: { url?: string };
      bin: Record<string, string>;
    };
    expect(manifest.name).toBe("h0x-cli");
    expect(manifest.homepage).toBe("https://pavii.tech");
    expect(manifest.repository?.url).toBe(
      "git+https://github.com/vjk7989/h0x-cli-v3.git",
    );
    expect(manifest.bin).toMatchObject({
      "h0x-cli": "dist/cli/index.js",
      "atomic-agent": "dist/cli/index.js",
      atag: "dist/cli/index.js",
      "atomic-agent-sidecar": "dist/sidecar/main.js",
    });
  });

  it("the POSIX installer installs h0x-cli and keeps only intentional aliases", () => {
    const script = read("scripts/install.sh");
    expect(script).toContain('link_alias h0x-cli "$INSTALL_DIR/atomic-agent"');
    expect(script).toContain('link_alias h0x-cli "$INSTALL_DIR/atag"');
    // Relative link target, so moving the install dir does not break it.
    expect(script).toContain('ln -sfn "$1" "$2"');
    expect(script).toContain(
      "https://raw.githubusercontent.com/buckleson/Pavii-cli-releases/main/scripts/install.sh",
    );
    expect(script).toContain("https://pavii.tech");
    expect(script).toContain("buckleson/Pavii-cli-releases");
  });

  it("the Windows installer writes h0x-cli and legacy command shims", () => {
    const script = read("scripts/install.ps1");
    expect(script).toContain('$BinaryPath = Join-Path $Stage "h0x-cli.exe"');
    expect(script).toContain("installed h0x-cli to $InstallDir\\h0x-cli.exe");
    expect(script).toContain('Join-Path $InstallDir "atomic-agent.cmd"');
    expect(script).toContain('Join-Path $InstallDir "atag.cmd"');
    // %~dp0 keeps the shim pointed at the binary beside it.
    expect(script).toContain('"`"%~dp0h0x-cli.exe`" %*"');
    expect(script).toContain(
      "https://raw.githubusercontent.com/buckleson/Pavii-cli-releases/main/scripts/install.ps1",
    );
    expect(script).toContain("https://pavii.tech");
    expect(script).toContain("buckleson/Pavii-cli-releases");
  });

  it("documents npm install prerequisites and the native-script fallback", () => {
    const readme = read("README.md");
    expect(readme).toContain("Node `25.7+`");
    expect(readme).toContain("npm install -g h0x-cli");
    expect(readme).toContain(
      "npm install -g --allow-scripts=better-sqlite3 h0x-cli",
    );
    expect(readme).toContain("EBADENGINE");
  });
});
