import { afterEach, describe, expect, it } from "vitest";

import { listAgentAdapters } from "./index.js";

const ENV_KEYS = [
  "H0X_CLI_EVAL_AGENTS",
  "ATOMIC_AGENT_EVAL_AGENTS",
  "H0X_CLI_EVAL_LLAMA_URL",
  "ATOMIC_AGENT_EVAL_LLAMA_URL",
  "OPENROUTER_API_KEY",
  "GEMINI_API_KEY",
  "H0X_CLI_GAIA_PROVIDER",
  "ATOMIC_AGENT_GAIA_PROVIDER",
] as const;

const savedEnv = new Map<string, string | undefined>();

for (const key of ENV_KEYS) {
  savedEnv.set(key, process.env[key]);
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("agent adapters", () => {
  it("registers h0x-cli and legacy comparison adapters", () => {
    const ids = listAgentAdapters().map((a) => a.id);
    expect(ids).toEqual(["h0x-cli", "atomic-agent", "hermes", "openclaw"]);
  });

  it("atomic-agent reports missing llama URL when unset", () => {
    const prev = process.env.ATOMIC_AGENT_EVAL_LLAMA_URL;
    delete process.env.ATOMIC_AGENT_EVAL_LLAMA_URL;
    try {
      const atomic = listAgentAdapters(["atomic-agent"])[0];
      expect(atomic?.probeRequirements().length).toBeGreaterThan(0);
    } finally {
      if (prev !== undefined) process.env.ATOMIC_AGENT_EVAL_LLAMA_URL = prev;
    }
  });

  it("h0x-cli uses OpenRouter and does not require a local llama URL", () => {
    delete process.env.H0X_CLI_EVAL_LLAMA_URL;
    delete process.env.ATOMIC_AGENT_EVAL_LLAMA_URL;
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";

    const h0x = listAgentAdapters(["h0x-cli"])[0];

    expect(h0x?.probeRequirements()).toEqual([]);
  });

  it("h0x-cli reports only the OpenRouter key as missing when unset", () => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.H0X_CLI_GAIA_PROVIDER;
    delete process.env.ATOMIC_AGENT_GAIA_PROVIDER;
    process.env.H0X_CLI_EVAL_LLAMA_URL = "https://h0x.example.invalid";
    process.env.ATOMIC_AGENT_EVAL_LLAMA_URL = "https://legacy.example.invalid";

    const h0x = listAgentAdapters(["h0x-cli"])[0];

    expect(h0x?.probeRequirements()).toEqual(["OPENROUTER_API_KEY"]);
  });

  it("h0x-cli reports only the Gemini key as missing when Gemini is selected", () => {
    delete process.env.GEMINI_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    process.env.H0X_CLI_GAIA_PROVIDER = "gemini";

    const h0x = listAgentAdapters(["h0x-cli"])[0];

    expect(h0x?.probeRequirements()).toEqual(["GEMINI_API_KEY"]);
  });

  it("h0x-cli uses Gemini when selected without requiring OpenRouter", () => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.H0X_CLI_GAIA_PROVIDER = "gemini";

    const h0x = listAgentAdapters(["h0x-cli"])[0];

    expect(h0x?.probeRequirements()).toEqual([]);
  });
});
