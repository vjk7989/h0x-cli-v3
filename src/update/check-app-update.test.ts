import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  APP_UPDATE_UNAVAILABLE,
  AppUpdateCheckError,
  checkForAppUpdate,
  resetAppReleaseCache,
} from "./check-app-update.js";
import { APP_UPDATE_UNAVAILABLE as EXPORTED_MESSAGE } from "./index.js";

describe("fork update checks", () => {
  const fetch = vi.fn().mockRejectedValue(new Error("Unexpected release request"));
  beforeEach(() => {
    fetch.mockClear();
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("ATOMIC_AGENT_REPO", "AtomicBot-ai/atomic-agent");
    vi.stubEnv("ATOMIC_AGENT_UPDATE_CHECK_ON_STARTUP", "1");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("exports the exact unavailable message through the public entrypoint", () => {
    expect(APP_UPDATE_UNAVAILABLE).toBe(
      "Updates are unavailable in this h0x-cli development build; release packaging is not ready.",
    );
    expect(EXPORTED_MESSAGE).toBe(APP_UPDATE_UNAVAILABLE);
  });

  it.each([
    undefined,
    { repo: "AtomicBot-ai/atomic-agent" },
    { repo: "fork/example", currentVersion: "0.0.0", force: true },
  ])("refuses release lookup for %j without contacting a server", async (options) => {
    await expect(checkForAppUpdate(options)).rejects.toThrow(AppUpdateCheckError);
    await expect(checkForAppUpdate(options)).rejects.toMatchObject({ message: APP_UPDATE_UNAVAILABLE, status: null });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not call an injected fetch even when forced", async () => {
    const injected = vi.fn().mockRejectedValue(new Error("Unexpected injected request"));
    await expect(checkForAppUpdate({ force: true, fetchImpl: injected })).rejects.toThrow(APP_UPDATE_UNAVAILABLE);
    expect(injected).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps cache reset callable without re-enabling release checks", async () => {
    expect(resetAppReleaseCache()).toBeUndefined();
    await expect(checkForAppUpdate()).rejects.toThrow(APP_UPDATE_UNAVAILABLE);
    expect(resetAppReleaseCache()).toBeUndefined();
    await expect(checkForAppUpdate()).rejects.toThrow(APP_UPDATE_UNAVAILABLE);
    expect(fetch).not.toHaveBeenCalled();
  });
});
