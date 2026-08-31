import { afterEach, describe, expect, it, vi } from "vitest";

import { AnalyticsClient, createAnalyticsClient } from "./analytics-client.js";
import { POSTHOG_PLACEHOLDER_KEY, POSTHOG_PROJECT_KEY } from "./posthog-config.js";
import { parseUserConfigFile } from "../config/config-schema.js";

const posthogConstructor = vi.hoisted(() => vi.fn(function () {
  throw new Error("The fork must not construct the PostHog SDK");
}));
vi.mock("posthog-node", () => ({ PostHog: posthogConstructor }));

function fakePosthog() {
  return {
    capture: vi.fn(),
    shutdown: vi.fn().mockResolvedValue(undefined),
  };
}

describe("AnalyticsClient", () => {
  it("attributes events to the anonymous install id and hardens privacy", () => {
    const posthog = fakePosthog();
    const client = new AnalyticsClient({
      installId: "install-123",
      platform: "darwin",
      version: "1.2.3",
      posthog,
    });

    client.capture("message_sent", { provider: "llama-server", model: "qwen" });

    expect(posthog.capture).toHaveBeenCalledTimes(1);
    const arg = posthog.capture.mock.calls[0][0];
    expect(arg.distinctId).toBe("install-123");
    expect(arg.event).toBe("message_sent");
    expect(arg.disableGeoip).toBe(true);
    // IP is overridden with a placeholder so PostHog never stores the real IP.
    expect(arg.properties.$ip).toBe("0.0.0.0");
    expect(arg.properties.platform).toBe("darwin");
    expect(arg.properties.app_version).toBe("1.2.3");
    expect(arg.properties.provider).toBe("llama-server");
    expect(arg.properties.model).toBe("qwen");
  });

  it("stamps the platform and app_version tags on every event, including bare ones", () => {
    const posthog = fakePosthog();
    const client = new AnalyticsClient({
      installId: "x",
      platform: "linux",
      version: "9.9.9",
      posthog,
    });
    client.capture("app_installed");
    expect(posthog.capture.mock.calls[0][0].properties.platform).toBe("linux");
    expect(posthog.capture.mock.calls[0][0].properties.app_version).toBe(
      "9.9.9",
    );
  });

  it("is fire-safe: swallows capture errors", () => {
    const posthog = {
      capture: vi.fn(() => {
        throw new Error("network down");
      }),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
    const client = new AnalyticsClient({
      installId: "x",
      platform: "darwin",
      version: "1.0.0",
      posthog,
    });
    expect(() => client.capture("app_installed")).not.toThrow();
  });

  it("createAnalyticsClient returns null when disabled", () => {
    const client = createAnalyticsClient({
      enabled: false,
      installId: "x",
      platform: "darwin",
      version: "1.0.0",
      posthog: fakePosthog(),
    });
    expect(client).toBeNull();
  });

  it("createAnalyticsClient builds a client when enabled", () => {
    const client = createAnalyticsClient({
      enabled: true,
      installId: "x",
      platform: "darwin",
      version: "1.0.0",
      posthog: fakePosthog(),
    });
    expect(client).toBeInstanceOf(AnalyticsClient);
  });

  it("createAnalyticsClient returns null under the test runner without an injected posthog", () => {
    // Vitest sets `process.env.VITEST`, so a real connection is never
    // opened during the suite — protects production analytics.
    const client = createAnalyticsClient({
      enabled: true,
      installId: "x",
      platform: "darwin",
      version: "1.0.0",
    });
    expect(client).toBeNull();
  });
});

describe("fork analytics defaults", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    posthogConstructor.mockClear();
  });

  it("ships the existing placeholder instead of the upstream ingestion key", () => {
    expect(POSTHOG_PROJECT_KEY).toBe(POSTHOG_PLACEHOLDER_KEY);
    expect(POSTHOG_PROJECT_KEY).toBe("PLACEHOLDER");
  });

  it("does not construct PostHog with an enabled legacy config outside test mode", async () => {
    const config = parseUserConfigFile({ version: 42, analytics: { enabled: true } });
    expect(config.analytics.enabled).toBe(true);
    // Exercise the placeholder gate, not the independent test-runner guard.
    vi.stubEnv("VITEST", undefined);
    vi.stubEnv("NODE_ENV", "production");
    const fetch = vi.fn().mockRejectedValue(new Error("Unexpected network request"));
    vi.stubGlobal("fetch", fetch);
    const client = createAnalyticsClient({
      enabled: config.analytics.enabled, installId: "legacy-install", platform: "win32", version: "0.4.2",
    });
    client?.capture("app_opened");
    await client?.shutdown();
    expect(client).toBeNull();
    expect(posthogConstructor).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
