import { afterEach, describe, expect, it, vi } from "vitest";

import { listHuggingFaceGgufFiles } from "./huggingface-api.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("huggingface-api", () => {
  it("identifies h0x-cli while preserving the Hugging Face endpoint", async () => {
    let requestUrl = "";
    let userAgent: string | null = null;
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL, init?: RequestInit) => {
      requestUrl = String(url);
      userAgent = new Headers(init?.headers).get("user-agent");
      return new Response(JSON.stringify([
        { path: "model.gguf", lfs: { size: 1234 } },
      ]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));

    const files = await listHuggingFaceGgufFiles("pavii/model", "main");

    expect(requestUrl).toBe("https://huggingface.co/api/models/pavii/model/tree/main?recursive=true");
    expect(userAgent).toMatch(/^h0x-cli(?:\/|$)/);
    expect(files).toEqual([{ path: "model.gguf", sizeBytes: 1234 }]);
  });
});
