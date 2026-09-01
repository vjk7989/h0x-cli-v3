import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { McpClient } from "./mcp-client.js";
import { McpRequestError } from "./mcp-errors.js";
import type { McpServerConfig } from "./mcp-types.js";

const fixture = vi.hoisted(() => {
  const messages: JSONRPCMessage[] = [];
  const envChecks: Array<{ inherited: boolean; overridden: boolean; added: boolean; cwd: string | undefined }> = [];
  const state = { toolError: false };
  const forbidden = vi.fn(() => { throw new Error("Audit isolation: external transport forbidden"); });

  // Real SDK Client, synthetic transport: no child, DNS, socket, or CLI.
  class StdioFixture {
    stderr = null;
    onmessage?: (message: JSONRPCMessage) => void;
    onclose?: () => void;
    constructor(options: { env?: Record<string, string>; cwd?: string }) {
      // Never retain or assert the full inherited environment: it can hold secrets.
      envChecks.push({
        inherited: options.env?.AUDIT_PARENT_SECRET === "synthetic-parent-secret",
        overridden: options.env?.AUDIT_OVERRIDE === "synthetic-server-override",
        added: options.env?.AUDIT_SERVER_ONLY === "synthetic-server-only",
        cwd: options.cwd,
      });
    }
    async start() {}
    async close() { this.onclose?.(); }
    async send(message: JSONRPCMessage) {
      messages.push(message);
      if (!("method" in message) || !("id" in message)) return;
      const id = message.id;
      let result: Record<string, unknown>;
      if (message.method === "initialize") {
        result = {
          protocolVersion: message.params?.protocolVersion,
          capabilities: { tools: {} },
          serverInfo: { name: "synthetic-audit-server", version: "0.0.0" },
        };
      } else if (message.method === "tools/list") {
        result = { tools: [] };
      } else if (message.method === "tools/call") {
        const text = "Authorization: Bearer synthetic-error-secret";
        if (!state.toolError) {
          queueMicrotask(() => this.onmessage?.({
            jsonrpc: "2.0", id, error: { code: -32603, message: text },
          }));
          return;
        }
        result = { isError: true, content: [{ type: "text", text }] };
      } else {
        throw new Error("Audit isolation: unexpected RPC method");
      }
      queueMicrotask(() => this.onmessage?.({ jsonrpc: "2.0", id, result }));
    }
  }
  return { messages, envChecks, state, forbidden, StdioFixture };
});

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({ StdioClientTransport: fixture.StdioFixture }));
vi.mock("@modelcontextprotocol/sdk/client/sse.js", () => ({ SSEClientTransport: fixture.forbidden }));
vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({ StreamableHTTPClientTransport: fixture.forbidden }));

function server(): McpServerConfig {
  return {
    name: "audit", enabled: true,
    transport: {
      kind: "stdio", command: "G:/h0xi/atomic-agent/never-execute-audit.exe",
      cwd: "G:/h0xi/atomic-agent",
    },
    env: { AUDIT_OVERRIDE: "synthetic-server-override", AUDIT_SERVER_ONLY: "synthetic-server-only" },
  };
}

beforeEach(() => {
  fixture.messages.length = 0;
  fixture.envChecks.length = 0;
  fixture.state.toolError = false;
  fixture.forbidden.mockClear();
  vi.stubGlobal("fetch", fixture.forbidden);
  vi.stubEnv("AUDIT_PARENT_SECRET", "synthetic-parent-secret");
  vi.stubEnv("AUDIT_OVERRIDE", "synthetic-parent-override");
  vi.stubEnv("AUDIT_SERVER_ONLY", undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  expect(fixture.forbidden).not.toHaveBeenCalled();
});

describe("network audit: MCP real SDK handshake over an in-memory transport", () => {
  it.each([false, true])("records identity/capabilities and ambient env inheritance (sampling=%s)", async (sampling) => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    ) as { version: string };
    const client = new McpClient(server(), sampling ? {
      samplingHandler: async () => ({
        role: "assistant", model: "synthetic-model", content: { type: "text", text: "synthetic" },
      }),
    } : {});
    try {
      await client.connect();
      expect(client.isConnected).toBe(true);
      // FINDING: unrelated parent secrets reach the stdio transport constructor.
      // This documents the current boundary; it is not an env-isolation pass.
      expect(fixture.envChecks).toEqual([{
        inherited: true, overridden: true, added: true, cwd: "G:/h0xi/atomic-agent",
      }]);
      expect(process.env.AUDIT_OVERRIDE === "synthetic-parent-override").toBe(true);
      const initialize = fixture.messages.find((message) => "method" in message && message.method === "initialize");
      expect(initialize).toMatchObject({ params: {
        clientInfo: { name: "h0x-cli", version: manifest.version },
        capabilities: sampling ? { sampling: {} } : {},
      } });
      expect(fixture.messages.map((message) => "method" in message ? message.method : "response")).toEqual([
        "initialize", "notifications/initialized", "tools/list",
      ]);
      // Environment inheritance is local; the initialize message does not carry it.
      expect(JSON.stringify(initialize).includes("synthetic-parent-secret")).toBe(false);
      // Server identity and MCP tool namespace stay provider-owned/protocol-owned.
      expect(server().name).toBe("audit");
    } finally {
      await client.close();
    }
    expect(client.isConnected).toBe(false);
  });

  it.each([false, true])("characterizes credential-like text in MCP errors (isError response=%s)", async (toolError) => {
    fixture.state.toolError = toolError;
    const client = new McpClient(server());
    try {
      await client.connect();
      const failure = await client.callTool("synthetic-tool", {}, new AbortController().signal)
        .then(() => null, (error: unknown) => error);
      expect(failure).toBeInstanceOf(McpRequestError);
      if (toolError) {
        // Current boundary: MCP isError tool text is promoted directly by the
        // client and remains a diagnostics-redaction follow-up, not connector
        // identity work.
        expect((failure as Error).message).toContain("Bearer synthetic-error-secret");
      } else {
        expect((failure as Error).message).toContain("Bearer <redacted>");
        expect((failure as Error).message).not.toContain("synthetic-error-secret");
      }
    } finally {
      await client.close();
    }
  });
});
