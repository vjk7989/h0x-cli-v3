import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApprovalGate } from "../../approval/approval-gate.js";
import type { CommandOptions, CommandResult } from "../../sandbox/command-runner.js";
import { buildOsHttpRequestTool } from "./http-request.js";
import { searchHttp } from "./web-search/transport/search-http.js";

const forbidden = vi.hoisted(() => vi.fn(() => {
  throw new Error("Audit isolation: real transport is forbidden");
}));
vi.mock("../../sandbox/command-runner.js", () => ({ runCommand: forbidden }));
vi.mock("node:dns/promises", () => ({ lookup: forbidden }));

const cwd = "G:/h0xi/atomic-agent";
const origin = "https://origin.audit.invalid/start";
const destination = "https://destination.audit.invalid/collect";
const headers = {
  Authorization: "Bearer synthetic-audit-token",
  Cookie: "session=synthetic-audit-cookie",
  "X-Api-Key": "synthetic-audit-api-key",
};
const body = JSON.stringify({ query: "synthetic-private-query", api_key: "synthetic-body-key" });

function fixture(stdouts: string[], exitCode = 0) {
  const calls: Array<{ args: string[]; input: CommandOptions["input"] }> = [];
  const lookup = vi.fn(async (hostname: string) => {
    if (!["origin.audit.invalid", "destination.audit.invalid"].includes(hostname)) {
      throw new Error("Audit isolation: unexpected DNS target");
    }
    // A public-shaped pin exercises the real SSRF guard; no socket is opened.
    return [{ address: "93.184.216.34", family: 4 }];
  });
  const runCommand = vi.fn(async (command: string, args: string[], options: CommandOptions): Promise<CommandResult> => {
    expect(command).toBe("curl");
    expect([origin, destination]).toContain(args.at(-1));
    expect(options.cwd).toBe(cwd);
    const stdout = stdouts[calls.length];
    if (stdout === undefined) throw new Error("Audit isolation: unexpected extra request");
    calls.push({ args: [...args], input: options.input });
    return {
      command, args, exitCode, signal: null, stdout,
      stderr: exitCode ? "synthetic curl failure" : "",
      durationMs: 1, timedOut: false, truncated: false, inputTruncated: false,
    };
  });
  return { calls, lookup, runCommand };
}

function httpMeta(status: number, redirect = "") {
  return `ok\n__ATOMIC_CURL_META__${status}|text/plain|2|0.01|${redirect}__ATOMIC_CURL_RA__`;
}

function httpTool(mock: ReturnType<typeof fixture>, hostAllowlist: string[] | null = null) {
  return buildOsHttpRequestTool({
    ...mock,
    approvalRequired: false,
    approvals: new ApprovalGate({ emit: () => { throw new Error("Unexpected approval"); } }),
    config: { http: {
      enabled: true, approvalMode: "never", hostAllowlist,
      maxResponseBytes: 4096, defaultTimeoutMs: 1000,
    } },
  });
}

function context() {
  return { workingDir: cwd, sessionId: "network-audit", stepIndex: 0, signal: new AbortController().signal };
}

beforeEach(() => {
  forbidden.mockClear();
  vi.stubGlobal("fetch", forbidden);
});
afterEach(() => {
  vi.unstubAllGlobals();
  expect(forbidden).not.toHaveBeenCalled();
});

// FINDING CHARACTERIZATION: passing assertions below reproduce unsafe current
// behavior. They are audit evidence, not a security acceptance gate or a fix.
describe("network audit findings: cross-origin redirects", () => {
  it("FINDING: an allowed initial host redirects to a host outside the configured allowlist", async () => {
    const mock = fixture([httpMeta(302, destination), httpMeta(200)]);
    const result = await httpTool(mock, ["origin.audit.invalid"]).run({ url: origin, headers }, context());
    expect(result.status).toBe("ok");
    expect(result.details.finalUrl).toBe(destination);
    expect(mock.calls).toHaveLength(2);
    expect(mock.calls[1]!.args.at(-1)).toBe(destination);
    expect(result.details.command).toContain(`Authorization: ${headers.Authorization}`);
  });

  it.each([302, 307])("FINDING: HTTP %i forwards credentials to a different origin", async (status) => {
    const mock = fixture([httpMeta(status, destination), httpMeta(200)]);
    const result = await httpTool(mock).run({ url: origin, method: "POST", headers, body }, context());
    expect(result.status).toBe("ok");
    expect(mock.calls).toHaveLength(2);
    expect(mock.lookup.mock.calls.map(([host]) => host)).toEqual([
      "origin.audit.invalid", "destination.audit.invalid",
    ]);
    expect(new URL(origin).origin).not.toBe(new URL(destination).origin);
    for (const [key, value] of Object.entries(headers)) {
      expect(mock.calls[1]!.args).toContain(`${key}: ${value}`);
    }
    expect(mock.calls[1]!.input).toBe(status === 307 ? body : undefined);
    expect(result.details.redirectChain).toEqual([origin, destination]);
    expect(result.details.command).toContain(`Authorization: ${headers.Authorization}`);
  });

  it.each([0, 7])("FINDING: curl exit %i exposes credentials in tool-result diagnostics", async (exitCode) => {
    const mock = fixture([httpMeta(200)], exitCode);
    const result = await httpTool(mock).run({ url: origin, headers }, context());
    expect(result.status).toBe(exitCode === 0 ? "ok" : "error");
    expect(mock.calls).toHaveLength(1);
    for (const [key, value] of Object.entries(headers)) {
      expect(result.details.command).toContain(`${key}: ${value}`);
    }
  });

  it.each([302, 303, 307, 308])("FINDING: search HTTP %i replays credentials AND POST body across origins", async (status) => {
    const mock = fixture([
      `\n__ATOMIC_WEB_SEARCH_META__${status}|text/plain|${destination}|0|__ATOMIC_WEB_SEARCH_HEADERS__`,
      "ok\n__ATOMIC_WEB_SEARCH_META__200|text/plain||2|__ATOMIC_WEB_SEARCH_HEADERS__",
    ]);
    const result = await searchHttp({
      ...mock, url: origin, method: "POST", headers, body, cwd,
      signal: new AbortController().signal, timeoutMs: 1000,
      retryPolicy: { maxRetries: 0, baseDelayMs: 0 },
    });
    expect(result.status).toBe(200);
    expect(result.redirectChain).toEqual([origin, destination]);
    expect(mock.calls).toHaveLength(2);
    expect(mock.lookup.mock.calls.map(([host]) => host)).toEqual([
      "origin.audit.invalid", "destination.audit.invalid",
    ]);
    const forwarded = mock.calls[1]!;
    for (const [key, value] of Object.entries(headers)) {
      expect(forwarded.args).toContain(`${key}: ${value}`);
    }
    expect(forwarded.args[forwarded.args.indexOf("-X") + 1]).toBe("POST");
    expect(forwarded.args).toContain("--data-binary");
    expect(forwarded.input).toBe(body);
  });
});
