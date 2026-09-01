import { afterEach, describe, expect, it, vi } from "vitest";

const posthogConstructor = vi.hoisted(() =>
  vi.fn(function () {
    return {
      capture: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
  }),
);
const forbiddenFetch = vi.hoisted(() => vi.fn(() => {
  throw new Error("Audit isolation: telemetry fetch must never be called");
}));
vi.mock("posthog-node", () => ({ PostHog: posthogConstructor }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  expect(forbiddenFetch).not.toHaveBeenCalled();
  forbiddenFetch.mockClear();
  posthogConstructor.mockClear();
});

// Compares the source factories with the already-built distribution under
// production flags. Missing/stale dist is a failing audit precondition; never
// build or skip here.
describe.each(["source", "existing-dist"] as const)("network audit: production telemetry %s", (artifact) => {
  it.each([false, true])("honors analytics.enabled=%s for PostHog and keeps Sentry inert", async (enabled) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITEST", undefined);
    vi.stubGlobal("fetch", forbiddenFetch);
    vi.resetModules();

    const analytics = artifact === "source"
      ? await import("../src/analytics/analytics-client.js")
      : await import("../dist/analytics/analytics-client.js");
    const errors = artifact === "source"
      ? await import("../src/error-reporting/sentry-client.js")
      : await import("../dist/error-reporting/sentry-client.js");
    const posthog = artifact === "source"
      ? await import("../src/analytics/posthog-config.js")
      : await import("../dist/analytics/posthog-config.js");
    const sentry = artifact === "source"
      ? await import("../src/error-reporting/sentry-config.js")
      : await import("../dist/error-reporting/sentry-config.js");

    // Compare booleans/prefixes, so failure diagnostics never print ingestion keys.
    expect(posthog.POSTHOG_PROJECT_KEY === "PLACEHOLDER").toBe(false);
    expect(posthog.POSTHOG_PROJECT_KEY.startsWith("phc_")).toBe(true);
    expect(posthog.POSTHOG_HOST).toBe("https://eu.i.posthog.com");
    expect(sentry.SENTRY_DSN === "PLACEHOLDER").toBe(true);

    for (const module of [analytics]) {
      const client = module.createAnalyticsClient({
        enabled, installId: "synthetic-audit-install", platform: "win32", version: "audit",
      });
      client?.capture("synthetic_audit_event", { model: "synthetic-model" });
      await client?.shutdown();
      expect(client === null).toBe(!enabled);
    }
    for (const module of [errors]) {
      const client = module.createSentryClient({
        enabled, installId: "synthetic-audit-install", platform: "win32", release: "audit",
      });
      client?.capture({ errorType: "SyntheticAuditError", source: "network-audit", frames: [] });
      await client?.shutdown();
      expect(client === null).toBe(true);
    }
  });
});
