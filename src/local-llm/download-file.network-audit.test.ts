import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadFile } from "./download-file.js";

const forbiddenWrite = vi.hoisted(() => vi.fn(() => {
  throw new Error("Audit isolation: download filesystem writes forbidden");
}));
vi.mock("node:fs", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:fs")>(),
  createWriteStream: forbiddenWrite, renameSync: forbiddenWrite, rmSync: forbiddenWrite,
}));

beforeEach(() => {
  forbiddenWrite.mockClear();
  // Override ALL aliases consulted by the implementation, never use real tokens.
  vi.stubEnv("GITHUB_TOKEN", "synthetic-github-token");
  vi.stubEnv("GH_TOKEN", undefined);
  vi.stubEnv("HF_TOKEN", "synthetic-hf-token");
  vi.stubEnv("HUGGING_FACE_HUB_TOKEN", undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  expect(forbiddenWrite).not.toHaveBeenCalled();
});

// FINDING CHARACTERIZATION: a pass confirms current credential disclosure;
// these expectations must change when a separately approved fix is implemented.
describe("network audit: download URL substring authentication", () => {
  it.each([
    ["github.com", "synthetic-github-token"],
    ["githubusercontent.com", "synthetic-github-token"],
    ["huggingface.co", "synthetic-hf-token"],
  ])("FINDING: %s in a query attaches its token to an unrelated host", async (marker, token) => {
    const url = `https://download.audit.invalid/model?mirror=${marker}`;
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe(url);
      expect(new URL(String(input)).hostname).toBe("download.audit.invalid");
      expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${token}`);
      // Rejected before streaming starts; even a regression cannot write a file.
      return new Response(null, { status: 401, statusText: "Synthetic Unauthorized" });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(downloadFile(url, "G:/h0xi/atomic-agent/.local/network-audit/never-written.bin"))
      .rejects.toThrow("Download failed: HTTP 401");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
