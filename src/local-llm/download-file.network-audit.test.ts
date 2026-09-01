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

describe("network audit: download URL origin authentication", () => {
  it.each([
    ["GitHub", "https://github.com/pavii/h0x-cli/releases/download/v0.0.0/model.gguf", "synthetic-github-token"],
    ["GitHub raw content", "https://raw.githubusercontent.com/pavii/h0x-cli/main/model.gguf", "synthetic-github-token"],
    ["Hugging Face", "https://huggingface.co/pavii/model/resolve/main/model.gguf", "synthetic-hf-token"],
  ])("attaches the %s token only for its trusted HTTPS origin", async (_label, url, token) => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe(url);
      expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${token}`);
      expect(new Headers(init?.headers).get("user-agent")).toMatch(/^h0x-cli(?:\/|$)/);
      expect(init?.redirect).toBe("manual");
      // Rejected before streaming starts; even a regression cannot write a file.
      return new Response(null, { status: 401, statusText: "Synthetic Unauthorized" });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(downloadFile(url, "G:/h0xi/atomic-agent/.local/network-audit/never-written.bin"))
      .rejects.toThrow("Download failed: HTTP 401");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    ["GitHub query marker", "https://download.audit.invalid/model?mirror=github.com"],
    ["GitHub raw query marker", "https://download.audit.invalid/model?mirror=raw.githubusercontent.com"],
    ["Hugging Face query marker", "https://download.audit.invalid/model?mirror=huggingface.co"],
    ["GitHub path marker", "https://download.audit.invalid/github.com/model.gguf"],
    ["Hugging Face path marker", "https://download.audit.invalid/huggingface.co/model.gguf"],
    ["GitHub userinfo marker", "https://github.com@download.audit.invalid/model.gguf"],
    ["Hugging Face userinfo marker", "https://huggingface.co@download.audit.invalid/model.gguf"],
    ["GitHub host lookalike", "https://github.com.download.audit.invalid/model.gguf"],
    ["GitHub raw host lookalike", "https://raw.githubusercontent.com.download.audit.invalid/model.gguf"],
    ["Hugging Face host lookalike", "https://huggingface.co.download.audit.invalid/model.gguf"],
    ["insecure GitHub origin", "http://github.com/pavii/h0x-cli/releases/download/v0.0.0/model.gguf"],
    ["insecure Hugging Face origin", "http://huggingface.co/pavii/model/resolve/main/model.gguf"],
  ])("does not attach a token for %s", async (_label, url) => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe(url);
      expect(new Headers(init?.headers).get("authorization")).toBeNull();
      expect(new Headers(init?.headers).get("user-agent")).toMatch(/^h0x-cli(?:\/|$)/);
      expect(init?.redirect).toBe("manual");
      return new Response(null, { status: 401, statusText: "Synthetic Unauthorized" });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(downloadFile(url, "G:/h0xi/atomic-agent/.local/network-audit/never-written.bin"))
      .rejects.toThrow("Download failed: HTTP 401");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not select credentials from redirect-looking query parameters before evaluating the next hop", async () => {
    const firstUrl = "https://download.audit.invalid/model?redirect=https%3A%2F%2Fhuggingface.co%2Fpavii%2Fmodel";
    const secondUrl = "https://huggingface.co/pavii/model/resolve/main/model.gguf";
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(init?.redirect).toBe("manual");
      const requestUrl = String(input);
      if (requestUrl === firstUrl) {
        expect(new Headers(init?.headers).get("authorization")).toBeNull();
        return new Response(null, {
          headers: { location: secondUrl },
          status: 302,
          statusText: "Synthetic Redirect",
        });
      }
      expect(requestUrl).toBe(secondUrl);
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer synthetic-hf-token");
      return new Response(null, { status: 401, statusText: "Synthetic Unauthorized" });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(downloadFile(firstUrl, "G:/h0xi/atomic-agent/.local/network-audit/never-written.bin"))
      .rejects.toThrow("Download failed: HTTP 401");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("evaluates token selection from the parsed trusted redirect destination", async () => {
    const firstUrl = "https://download.audit.invalid/model.gguf";
    const secondUrl = "https://huggingface.co/pavii/model/resolve/main/model.gguf";
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(init?.redirect).toBe("manual");
      const requestUrl = String(input);
      if (requestUrl === firstUrl) {
        expect(new Headers(init?.headers).get("authorization")).toBeNull();
        return new Response(null, {
          headers: { location: secondUrl },
          status: 302,
          statusText: "Synthetic Redirect",
        });
      }
      expect(requestUrl).toBe(secondUrl);
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer synthetic-hf-token");
      return new Response(null, { status: 401, statusText: "Synthetic Unauthorized" });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(downloadFile(firstUrl, "G:/h0xi/atomic-agent/.local/network-audit/never-written.bin"))
      .rejects.toThrow("Download failed: HTTP 401");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("drops a trusted-origin token when a redirect moves to an untrusted destination", async () => {
    const firstUrl = "https://github.com/pavii/h0x-cli/releases/download/v0.0.0/model.gguf";
    const secondUrl = "https://download.audit.invalid/model.gguf";
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(init?.redirect).toBe("manual");
      const requestUrl = String(input);
      if (requestUrl === firstUrl) {
        expect(new Headers(init?.headers).get("authorization")).toBe("Bearer synthetic-github-token");
        return new Response(null, {
          headers: { location: secondUrl },
          status: 302,
          statusText: "Synthetic Redirect",
        });
      }
      expect(requestUrl).toBe(secondUrl);
      expect(new Headers(init?.headers).get("authorization")).toBeNull();
      return new Response(null, { status: 401, statusText: "Synthetic Unauthorized" });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(downloadFile(firstUrl, "G:/h0xi/atomic-agent/.local/network-audit/never-written.bin"))
      .rejects.toThrow("Download failed: HTTP 401");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
