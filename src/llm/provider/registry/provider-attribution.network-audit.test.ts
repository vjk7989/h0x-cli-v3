import { afterEach, describe, expect, it, vi } from "vitest";
import { registerBuiltInProviderKinds } from "./register-built-in-providers.js";
import { getProviderFactory } from "./provider-types.js";

const baseUrl = "http://127.0.0.1:43199/audit";
const apiKey = "synthetic-provider-key";
const prompt = "### conversation\nsynthetic-private-prompt";
const tools = [{
  type: "function" as const,
  function: {
    name: "synthetic_tool", description: "synthetic-description",
    parameters: { type: "object", properties: { value: { type: "string" } } },
  },
}];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// Exercises the production registry factories, not hand-supplied attribution
// options on the wrappers (already covered by their existing unit tests).
describe.each(["openrouter", "aimlapi"])("network audit: %s factory payload and attribution", (kind) => {
  it.each([false, true])("records synthetic outbound payload in a local fetch mock (stream=%s)", async (stream) => {
    const captured: Array<{ headers: Headers; body: Record<string, unknown> }> = [];
    vi.stubEnv("AUDIT_UNRELATED_SECRET", "synthetic-unrelated-environment-secret");
    // Never delegate to native fetch, even for loopback. Any unexpected target
    // fails within this mock; no provider authentication or sockets are used.
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe(`${baseUrl}/v1/chat/completions`);
      expect(init?.method).toBe("POST");
      captured.push({ headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
      if (stream) {
        return new Response([
          `data: ${JSON.stringify({ choices: [{ delta: { content: "synthetic reply" }, finish_reason: null }] })}\n\n`,
          `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\n`,
          "data: [DONE]\n\n",
        ].join(""), { headers: { "content-type": "text/event-stream" } });
      }
      return new Response(JSON.stringify({
        model: "synthetic-model",
        choices: [{ message: { role: "assistant", content: "synthetic reply" }, finish_reason: "stop" }],
      }), { headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    registerBuiltInProviderKinds();
    const factory = getProviderFactory(kind);
    expect(factory).toBeDefined();
    // Neither remote factory reads config/logger; forbid accidental expansion
    // into local runtime configuration rather than reading the user's state.
    const unused = new Proxy({}, { get() { throw new Error("Audit isolation: unexpected config/logger read"); } });
    const provider = await factory!({
      config: unused as never, logger: unused as never,
      entry: { id: kind, kind, baseUrl, apiKey, defaultChatModel: "synthetic-model", requestTimeoutMs: 1000 },
    });
    try {
      const request = { prompt, maxTokens: 16, temperature: 0, tools, toolChoice: "auto" as const };
      if (stream) {
        const iterator = provider.completeStream(request);
        while (!(await iterator.next()).done) { /* Drain synthetic SSE. */ }
      } else {
        await provider.complete(request);
      }
      expect(fetchMock).toHaveBeenCalledOnce();
      const sent = captured[0]!;
      expect(sent.body).toEqual({
        model: "synthetic-model", messages: [{ role: "user", content: prompt }],
        max_tokens: 16, temperature: 0, stream, tools, tool_choice: "auto", parallel_tool_calls: true,
      });
      expect(sent.headers.get("authorization")).toBe(`Bearer ${apiKey}`);
      expect(JSON.stringify(sent.body)).not.toContain(apiKey);
      expect(JSON.stringify([Object.fromEntries(sent.headers), sent.body])).not.toContain("synthetic-unrelated-environment-secret");
      if (kind === "openrouter") {
        expect(sent.headers.get("http-referer")).toBe("https://pavii.tech");
        expect(sent.headers.get("x-openrouter-title")).toBe("h0x-cli by PAVii.Ai");
        // Backward-compatible attribution for older OpenRouter integrations.
        expect(sent.headers.get("x-title")).toBe("h0x-cli by PAVii.Ai");
        expect(sent.headers.get("x-openrouter-categories")).toBe("cli-agent,personal-agent");
        expect(sent.headers.get("x-aimlapi-source")).toBeNull();
      } else {
        expect(sent.headers.get("x-aimlapi-source")).toBe("agent/h0x-cli");
        expect(sent.headers.get("x-aimlapi-partner-id")).toBeNull();
        expect(sent.headers.get("http-referer")).toBeNull();
        expect(sent.headers.get("x-title")).toBeNull();
      }
    } finally {
      await provider.close();
    }
  });
});
