import { createServer, type IncomingHttpHeaders } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LlmProvider } from "../src/llm/provider/llm-provider.js";
import type { OpenAiProviderOptions } from "../src/llm/provider/openai/openai-provider.js";

// Capture native fetch before replacing the global entry point with a guard.
// It is reachable below only after validating the fixture's exact origin/path.
const nativeFetch = globalThis.fetch.bind(globalThis);
const requestPath = "/audit/v1/chat/completions";
const apiKey = "synthetic-loopback-api-key";
const prompt = "synthetic-loopback-private-prompt";
const reply = "synthetic-loopback-reply";
const model = "synthetic-loopback-model";

async function loadProvider(
  artifact: "source" | "existing-dist",
  kind: "openrouter" | "aimlapi",
  options: OpenAiProviderOptions,
): Promise<LlmProvider> {
  if (kind === "openrouter") {
    const module = artifact === "source"
      ? await import("../src/llm/provider/openrouter/openrouter-provider.js")
      : await import("../dist/llm/provider/openrouter/openrouter-provider.js");
    // Match the registry's attribution options; factory-default wiring itself
    // is covered in provider-attribution.network-audit.test.ts.
    return new module.OpenRouterProvider({
      ...options,
      httpReferer: module.OPENROUTER_APP_REFERER,
      xTitle: module.OPENROUTER_APP_TITLE,
      categories: module.OPENROUTER_APP_CATEGORIES,
    });
  }
  const module = artifact === "source"
    ? await import("../src/llm/provider/aimlapi/aimlapi-provider.js")
    : await import("../dist/llm/provider/aimlapi/aimlapi-provider.js");
  return new module.AimlapiProvider(options);
}

afterEach(() => vi.unstubAllGlobals());

// No bootstrap, subprocesses, external services, filesystem artifacts, or
// rebuilds. Existing dist is required: a missing artifact fails, never skips.
describe.each(["source", "existing-dist"] as const)("network audit: actual loopback receipt %s", (artifact) => {
  it.each(["openrouter", "aimlapi"] as const)("receives %s headers/body and returns its reply", async (kind) => {
    // Runner must sanitize proxy settings. Fail before any socket, without
    // printing their values, if this bounded network test is launched unsafely.
    for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]) {
      expect(Boolean(process.env[key]), `Audit isolation: ${key} must be absent`).toBe(false);
    }
    const unexpectedFetch = vi.fn(() => {
      throw new Error("Audit isolation: unexpected global fetch");
    });
    vi.stubGlobal("fetch", unexpectedFetch);

    const received: Array<{
      method: string | undefined;
      url: string | undefined;
      headers: IncomingHttpHeaders;
      body: string;
      remoteAddress: string | undefined;
    }> = [];
    const serverErrors: string[] = [];
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      request.on("error", () => serverErrors.push("request error"));
      request.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 8192) {
          serverErrors.push("fixture request exceeded 8192 bytes");
          request.destroy();
          return;
        }
        chunks.push(chunk);
      });
      request.on("end", () => {
        received.push({
          method: request.method, url: request.url, headers: { ...request.headers },
          body: Buffer.concat(chunks).toString("utf8"),
          remoteAddress: request.socket.remoteAddress,
        });
        response.writeHead(200, { "content-type": "application/json", connection: "close" });
        response.end(JSON.stringify({
          id: "synthetic-loopback-completion", model,
          choices: [{ message: { role: "assistant", content: reply }, finish_reason: "stop" }],
        }));
      });
    });
    server.requestTimeout = 3000;
    server.headersTimeout = 3000;
    let provider: LlmProvider | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
          server.off("error", reject);
          resolve();
        });
      });
      const address = server.address();
      if (!address || typeof address === "string" || address.address !== "127.0.0.1") {
        throw new Error("Audit isolation: listener is not IPv4 loopback");
      }
      const origin = `http://127.0.0.1:${address.port}`;
      const loopbackFetch: typeof fetch = async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        if (url.origin !== origin || url.pathname !== requestPath || url.search || url.hash || url.username || url.password) {
          throw new Error("Audit isolation: target outside exact loopback fixture");
        }
        return nativeFetch(input, {
          ...init,
          redirect: "error",
          signal: AbortSignal.any([
            AbortSignal.timeout(3000),
            ...(init?.signal ? [init.signal] : []),
          ]),
        });
      };
      // Prove an external target is rejected before native fetch is reachable.
      await expect(loopbackFetch("https://outside.audit.invalid/"))
        .rejects.toThrow("target outside exact loopback fixture");

      provider = await loadProvider(artifact, kind, {
        id: `audit-${kind}`, baseUrl: `${origin}/audit`, apiKey,
        defaultChatModel: model, requestTimeoutMs: 2000, fetchImpl: loopbackFetch,
      });
      const result = await provider.complete({ prompt, temperature: 0, maxTokens: 16 });
      expect(result.content).toBe(reply);
      expect(received).toHaveLength(1);
      expect(serverErrors).toEqual([]);
      const request = received[0]!;
      expect(request.remoteAddress).toBe("127.0.0.1");
      expect(request.method).toBe("POST");
      expect(request.url).toBe(requestPath);
      expect(request.headers.host).toBe(`127.0.0.1:${address.port}`);
      expect(request.headers.authorization).toBe(`Bearer ${apiKey}`);
      expect(request.headers["content-type"]).toContain("application/json");
      expect(JSON.parse(request.body)).toEqual({
        model, messages: [{ role: "user", content: prompt }],
        temperature: 0, max_tokens: 16, stream: false,
      });
      expect(request.body).not.toContain(apiKey);
      if (kind === "openrouter") {
        expect(request.headers["http-referer"]).toBe("https://pavii.tech");
        expect(request.headers["x-openrouter-title"]).toBe("h0x-cli by PAVii.Ai");
        expect(request.headers["x-title"]).toBe("h0x-cli by PAVii.Ai");
        expect(request.headers["x-openrouter-categories"]).toBe("cli-agent,personal-agent");
      } else {
        expect(request.headers["x-aimlapi-source"]).toBe("agent/h0x-cli");
        expect(request.headers["x-aimlapi-partner-id"]).toBeUndefined();
        expect(request.headers["http-referer"]).toBeUndefined();
        expect(request.headers["x-title"]).toBeUndefined();
      }
    } finally {
      try {
        await provider?.close();
      } finally {
        await new Promise<void>((resolve, reject) => {
          if (!server.listening) return resolve();
          server.close((error) => error ? reject(error) : resolve());
          server.closeAllConnections();
        });
        expect(unexpectedFetch).not.toHaveBeenCalled();
      }
    }
  });
});
