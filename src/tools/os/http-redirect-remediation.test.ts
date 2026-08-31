import { describe, expect, it, vi } from "vitest";
import { ApprovalGate } from "../../approval/approval-gate.js";
import type { CommandOptions, CommandResult } from "../../sandbox/command-runner.js";
import { buildOsHttpRequestTool } from "./http-request.js";
import { searchHttp } from "./web-search/transport/search-http.js";

const cwd = "G:/h0xi/atomic-agent";
const origin = "https://origin.audit.invalid/start";
const sameOriginDestination = "https://origin.audit.invalid/final";
const crossOriginDestination = "https://destination.audit.invalid/collect";
const sensitiveHeaders = {
  Authorization: "Bearer synthetic-audit-token",
  authorization: "Bearer lower-case-synthetic-token",
  Cookie: "session=synthetic-audit-cookie",
  "X-Api-Key": "synthetic-audit-api-key",
  "X-Subscription-Token": "synthetic-search-token",
  "Proxy-Authorization": "Basic synthetic-proxy-token",
};
const safeHeaders = {
  Accept: "application/json",
  "X-Request-Id": "synthetic-request-id",
};
const headers = { ...safeHeaders, ...sensitiveHeaders };
const body = JSON.stringify({
  query: "synthetic-private-query",
  api_key: "synthetic-body-key",
});

function fixture(stdouts: string[], allowedHosts = ["origin.audit.invalid", "destination.audit.invalid"]) {
  const calls: Array<{ args: string[]; input: CommandOptions["input"] }> = [];
  const lookup = vi.fn(async (hostname: string) => {
    if (!allowedHosts.includes(hostname)) {
      throw new Error(`Audit isolation: unexpected DNS target ${hostname}`);
    }
    return [{ address: "93.184.216.34", family: 4 }];
  });
  const runCommand = vi.fn(async (command: string, args: string[], options: CommandOptions): Promise<CommandResult> => {
    expect(command).toBe("curl");
    expect([origin, sameOriginDestination, crossOriginDestination]).toContain(args.at(-1));
    expect(options.cwd).toBe(cwd);
    const stdout = stdouts[calls.length];
    if (stdout === undefined) throw new Error("Audit isolation: unexpected extra request");
    calls.push({ args: [...args], input: options.input });
    return {
      command,
      args,
      exitCode: 0,
      signal: null,
      stdout,
      stderr: "",
      durationMs: 1,
      timedOut: false,
      truncated: false,
      inputTruncated: false,
    };
  });
  return { calls, lookup, runCommand };
}

function httpMeta(status: number, redirect = "") {
  return `ok\n__ATOMIC_CURL_META__${status}|text/plain|2|0.01|${redirect}__ATOMIC_CURL_RA__`;
}

function searchMeta(status: number, redirect = "") {
  return `ok\n__ATOMIC_WEB_SEARCH_META__${status}|text/plain|${redirect}|2|__ATOMIC_WEB_SEARCH_HEADERS__`;
}

function httpTool(mock: ReturnType<typeof fixture>, hostAllowlist: string[] | null = null) {
  return buildOsHttpRequestTool({
    ...mock,
    approvalRequired: false,
    approvals: new ApprovalGate({
      emit: () => {
        throw new Error("Unexpected approval");
      },
    }),
    config: {
      http: {
        enabled: true,
        approvalMode: "never",
        hostAllowlist,
        maxResponseBytes: 4096,
        defaultTimeoutMs: 1000,
      },
    },
  });
}

function context() {
  return {
    workingDir: cwd,
    sessionId: "redirect-remediation",
    stepIndex: 0,
    signal: new AbortController().signal,
  };
}

function hasHeader(args: string[], key: string, value: string) {
  return args.includes(`${key}: ${value}`);
}

function expectSensitiveHeadersAbsent(args: string[]) {
  for (const [key, value] of Object.entries(sensitiveHeaders)) {
    expect(hasHeader(args, key, value)).toBe(false);
  }
}

function expectSafeHeadersPresent(args: string[]) {
  for (const [key, value] of Object.entries(safeHeaders)) {
    expect(hasHeader(args, key, value)).toBe(true);
  }
}

function expectSensitiveHeadersPresent(args: string[]) {
  for (const [key, value] of Object.entries(sensitiveHeaders)) {
    expect(hasHeader(args, key, value)).toBe(true);
  }
}

describe("redirect credential remediation: os.http.request", () => {
  it("preserves caller credentials on a same-origin 307 redirect", async () => {
    const mock = fixture([httpMeta(307, sameOriginDestination), httpMeta(200)]);
    const result = await httpTool(mock).run({ url: origin, method: "POST", headers, body }, context());

    expect(result.status).toBe("ok");
    expect(result.details.redirectChain).toEqual([origin, sameOriginDestination]);
    expect(mock.calls).toHaveLength(2);
    expectSensitiveHeadersPresent(mock.calls[1]!.args);
    expectSafeHeadersPresent(mock.calls[1]!.args);
    expect(mock.calls[1]!.args[mock.calls[1]!.args.indexOf("-X") + 1]).toBe("POST");
    expect(mock.calls[1]!.input).toBe(body);
  });

  it.each([301, 302, 303])(
    "strips credential-like headers on HTTP %i cross-origin redirects",
    async (status) => {
      const mock = fixture([httpMeta(status, crossOriginDestination), httpMeta(200)]);
      const result = await httpTool(mock).run({ url: origin, method: "POST", headers, body }, context());

      expect(result.status).toBe("ok");
      expect(result.details.redirectChain).toEqual([origin, crossOriginDestination]);
      expect(mock.calls).toHaveLength(2);
      expectSensitiveHeadersAbsent(mock.calls[1]!.args);
      expectSafeHeadersPresent(mock.calls[1]!.args);
    },
  );

  it.each([307, 308])(
    "refuses to forward a request body on HTTP %i cross-origin redirects",
    async (status) => {
      const mock = fixture([httpMeta(status, crossOriginDestination)]);

      const result = await httpTool(mock).run(
        { url: origin, method: "POST", headers, body },
        context(),
      );

      expect(result.status).toBe("error");
      expect(result.summary).toMatch(/refused to forward a request body across origins/i);
      expect(result.details).toMatchObject({ blocked: true, method: "POST", url: origin });
      expect(mock.calls).toHaveLength(1);
    },
  );

  it("applies the configured host allowlist to every redirect hop", async () => {
    const mock = fixture([httpMeta(302, crossOriginDestination)]);

    const result = await httpTool(mock, ["origin.audit.invalid"]).run(
      { url: origin, headers },
      context(),
    );

    expect(result.status).toBe("error");
    expect(result.summary).toMatch(/destination\.audit\.invalid|host/i);
    expect(result.details).toMatchObject({ blocked: true, method: "GET", url: origin });
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]!.args.at(-1)).toBe(origin);
  });
});

describe("redirect credential remediation: web search HTTP transport", () => {
  it("preserves caller credentials on a same-origin 307 redirect", async () => {
    const mock = fixture([searchMeta(307, sameOriginDestination), searchMeta(200)]);
    const result = await searchHttp({
      ...mock,
      url: origin,
      method: "POST",
      headers,
      body,
      cwd,
      signal: new AbortController().signal,
      timeoutMs: 1000,
      retryPolicy: { maxRetries: 0, baseDelayMs: 0 },
    });

    expect(result.status).toBe(200);
    expect(result.redirectChain).toEqual([origin, sameOriginDestination]);
    expectSensitiveHeadersPresent(mock.calls[1]!.args);
    expectSafeHeadersPresent(mock.calls[1]!.args);
    expect(mock.calls[1]!.args[mock.calls[1]!.args.indexOf("-X") + 1]).toBe("POST");
    expect(mock.calls[1]!.input).toBe(body);
  });

  it.each([301, 302, 303])(
    "strips credential-like headers on search HTTP %i cross-origin redirects",
    async (status) => {
      const mock = fixture([searchMeta(status, crossOriginDestination), searchMeta(200)]);
      const result = await searchHttp({
        ...mock,
        url: origin,
        method: "POST",
        headers,
        body,
        cwd,
        signal: new AbortController().signal,
        timeoutMs: 1000,
        retryPolicy: { maxRetries: 0, baseDelayMs: 0 },
      });

      expect(result.status).toBe(200);
      expect(result.redirectChain).toEqual([origin, crossOriginDestination]);
      expect(mock.calls).toHaveLength(2);
      expectSensitiveHeadersAbsent(mock.calls[1]!.args);
      expectSafeHeadersPresent(mock.calls[1]!.args);
    },
  );

  it.each([307, 308])(
    "refuses to forward a request body on search HTTP %i cross-origin redirects",
    async (status) => {
      const mock = fixture([searchMeta(status, crossOriginDestination)]);

      await expect(
        searchHttp({
          ...mock,
          url: origin,
          method: "POST",
          headers,
          body,
          cwd,
          signal: new AbortController().signal,
          timeoutMs: 1000,
          retryPolicy: { maxRetries: 0, baseDelayMs: 0 },
        }),
      ).rejects.toThrow(/refused to forward a request body across origins/i);

      expect(mock.calls).toHaveLength(1);
    },
  );

  it.each([301, 302, 303])(
    "drops a POST body when search HTTP %i follows curl-style cross-origin GET redirect",
    async (status) => {
      const mock = fixture([searchMeta(status, crossOriginDestination), searchMeta(200)]);
      await searchHttp({
        ...mock,
        url: origin,
        method: "POST",
        headers,
        body,
        cwd,
        signal: new AbortController().signal,
        timeoutMs: 1000,
        retryPolicy: { maxRetries: 0, baseDelayMs: 0 },
      });

      const redirected = mock.calls[1]!;
      expect(redirected.args).not.toContain("-X");
      expect(redirected.args).not.toContain("--data-binary");
      expect(redirected.input).toBeUndefined();
    },
  );
});
