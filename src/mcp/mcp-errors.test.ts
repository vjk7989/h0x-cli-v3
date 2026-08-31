import { describe, expect, it } from "vitest";

import {
  McpConnectError,
  McpError,
  McpRequestError,
  scrubErrorMessage,
} from "./mcp-errors.js";

describe("McpError hierarchy", () => {
  it("McpError carries server + message", () => {
    const err = new McpError("github", "boom");
    expect(err.server).toBe("github");
    expect(err.message).toBe("boom");
    expect(err.name).toBe("McpError");
    expect(err).toBeInstanceOf(Error);
  });

  it("McpConnectError is an McpError with the right name", () => {
    const err = new McpConnectError("github", "connection refused");
    expect(err.name).toBe("McpConnectError");
    expect(err).toBeInstanceOf(McpError);
    expect(err.server).toBe("github");
  });

  it("McpRequestError carries operation and is an McpError", () => {
    const err = new McpRequestError("github", "tools/call", "isError true");
    expect(err.name).toBe("McpRequestError");
    expect(err.operation).toBe("tools/call");
    expect(err).toBeInstanceOf(McpError);
  });
});

describe("scrubErrorMessage", () => {
  it("returns `(no error)` for null and undefined", () => {
    expect(scrubErrorMessage(null)).toBe("(no error)");
    expect(scrubErrorMessage(undefined)).toBe("(no error)");
  });

  it("strips the leading `Error:` prefix", () => {
    expect(scrubErrorMessage(new Error("connection refused"))).toBe(
      "connection refused",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(scrubErrorMessage("   hi there  ")).toBe("hi there");
  });

  it("clips long messages to the configured max length", () => {
    const longMsg = "a".repeat(500);
    const out = scrubErrorMessage(longMsg, 100);
    expect(out.length).toBe(100);
    expect(out.endsWith("…")).toBe(true);
  });

  it("coerces non-Error inputs through String()", () => {
    expect(scrubErrorMessage({ toString: () => "boom" })).toBe("boom");
  });

  it("uses default max length of 200", () => {
    const longMsg = "x".repeat(500);
    expect(scrubErrorMessage(longMsg).length).toBe(200);
  });

  it("redacts credential-like values before returning user-facing errors", () => {
    const out = scrubErrorMessage(
      [
        "Error: request failed",
        "Authorization: Bearer synthetic-mcp-bearer-secret",
        "Cookie: sid=synthetic-mcp-cookie-secret",
        "x-api-key=synthetic-mcp-api-key-secret",
        "https://user:synthetic-url-secret@example.com/path?token=synthetic-query-secret",
        "request id public-request-id",
      ].join("\n"),
      500,
    );

    expect(out).not.toContain("synthetic-mcp-bearer-secret");
    expect(out).not.toContain("synthetic-mcp-cookie-secret");
    expect(out).not.toContain("synthetic-mcp-api-key-secret");
    expect(out).not.toContain("synthetic-url-secret");
    expect(out).not.toContain("synthetic-query-secret");
    expect(out).toContain("public-request-id");
  });
});
