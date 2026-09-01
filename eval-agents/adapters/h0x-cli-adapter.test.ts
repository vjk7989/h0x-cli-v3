import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const spawnAgentRun = vi.fn();
const parseCliOutput = vi.fn();
const collectTraceMetrics = vi.fn();

vi.mock("../../eval/harness/spawn-agent.js", () => ({ spawnAgentRun }));
vi.mock("../../eval/harness/parse-cli-output.js", () => ({ parseCliOutput }));
vi.mock("../../eval/harness/parse-trace-metrics.js", () => ({ collectTraceMetrics }));

const ENV_KEYS = [
  "OPENROUTER_API_KEY",
  "GEMINI_API_KEY",
  "NVIDIA_API_KEY",
  "AZURE_OPENAI_API_KEY",
  "H0X_CLI_GAIA_PROVIDER",
  "ATOMIC_AGENT_GAIA_PROVIDER",
  "H0X_CLI_GAIA_MODEL",
  "ATOMIC_AGENT_GAIA_MODEL",
] as const;

const savedEnv = new Map<string, string | undefined>();
const TMP_ROOT = resolve("G:\\h0xi\\atomic-agent", "tmp", "gaia-adapter-tests");

for (const key of ENV_KEYS) {
  savedEnv.set(key, process.env[key]);
}

describe("h0x-cli OpenRouter GAIA adapter", () => {
  beforeEach(() => {
    vi.resetModules();
    spawnAgentRun.mockReset();
    parseCliOutput.mockReset();
    collectTraceMetrics.mockReset();
    process.env.OPENROUTER_API_KEY = "test-openrouter-secret";
    process.env.GEMINI_API_KEY = "test-gemini-secret";
    process.env.NVIDIA_API_KEY = "test-nvidia-secret";
    process.env.AZURE_OPENAI_API_KEY = "test-azure-secret";
    delete process.env.H0X_CLI_GAIA_PROVIDER;
    delete process.env.ATOMIC_AGENT_GAIA_PROVIDER;
    delete process.env.H0X_CLI_GAIA_MODEL;
    delete process.env.ATOMIC_AGENT_GAIA_MODEL;
    rmSync(TMP_ROOT, { recursive: true, force: true });
    mkdirSync(TMP_ROOT, { recursive: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of ENV_KEYS) {
      const value = savedEnv.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    rmSync(TMP_ROOT, { recursive: true, force: true });
  });

  it("seeds OpenRouter as the active provider with the default pilot model", async () => {
    const { createH0xCliAdapter } = await import("./h0x-cli-adapter.js");
    const adapter = createH0xCliAdapter();
    const workingDir = join(TMP_ROOT, "cwd");
    const stateDir = join(TMP_ROOT, "state");
    mkdirSync(workingDir, { recursive: true });
    spawnAgentRun.mockResolvedValue({
      stdout: "stdout",
      stderr: "",
      exitCode: 0,
      timedOut: false,
      durationMs: 123,
    });
    parseCliOutput.mockReturnValue({
      reply: "FINAL ANSWER: Oslo",
      sessionId: "session-1",
      stepCount: 2,
      lastError: null,
    });
    collectTraceMetrics.mockResolvedValue({
      stepCount: 2,
      totalPromptTokens: 100,
      totalPredictedTokens: 12,
      toolErrorCount: 0,
    });

    await adapter.runQuestion({
      row: {
        task_id: "fixture-1",
        Question: "What is the answer?",
        Level: 1,
        "Final answer": "Oslo",
        file_name: "",
        file_path: "",
      },
      workingDir,
      stateDir,
      prompt: "Question\nFINAL ANSWER:",
      maxSteps: 5,
      timeoutMs: 10_000,
      chatUrl: "",
      embedUrl: null,
    });

    const seededConfig = readFileSync(join(stateDir, "config.json"), "utf8");
    expect(seededConfig).toContain('"activeTextProvider": "openrouter"');
    expect(seededConfig).toContain('"apiKeyEnvVar": "OPENROUTER_API_KEY"');
    expect(seededConfig).toContain('"defaultChatModel": "openai/gpt-4o-mini"');
    expect(seededConfig).toContain('"analytics":');
    expect(seededConfig).toContain('"enabled": false');
    expect(seededConfig).not.toContain("test-openrouter-secret");
    expect(seededConfig).not.toContain("test-gemini-secret");

    expect(spawnAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        workingDir,
        stateDir,
        prompt: "Question\nFINAL ANSWER:",
        maxSteps: 5,
        timeoutMs: 10_000,
        requireDist: true,
      }),
    );
    expect(collectTraceMetrics).toHaveBeenCalledWith(
      join(stateDir, "traces", "session-1.ndjson"),
    );
  });

  it("prefers H0X_CLI_GAIA_MODEL over the legacy ATOMIC_AGENT_GAIA_MODEL", async () => {
    const { createH0xCliAdapter } = await import("./h0x-cli-adapter.js");
    const workingDir = join(TMP_ROOT, "cwd");
    const stateDir = join(TMP_ROOT, "state");
    mkdirSync(workingDir, { recursive: true });
    process.env.H0X_CLI_GAIA_MODEL = "openrouter/h0x-preferred";
    process.env.ATOMIC_AGENT_GAIA_MODEL = "openrouter/legacy";
    spawnAgentRun.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
      timedOut: false,
      durationMs: 1,
    });
    parseCliOutput.mockReturnValue({
      reply: "FINAL ANSWER: preferred",
      sessionId: null,
      stepCount: 1,
      lastError: null,
    });

    await createH0xCliAdapter().runQuestion({
      row: {
        task_id: "fixture-2",
        Question: "Which model?",
        Level: 1,
        "Final answer": "preferred",
        file_name: "",
        file_path: "",
      },
      workingDir,
      stateDir,
      prompt: "Question",
      maxSteps: 1,
      timeoutMs: 1000,
      chatUrl: "",
      embedUrl: null,
    });

    const seededConfig = readFileSync(join(stateDir, "config.json"), "utf8");
    expect(seededConfig).toContain('"defaultChatModel": "openrouter/h0x-preferred"');
    expect(seededConfig).not.toContain("openrouter/legacy");
  });

  it("seeds Gemini when the h0x GAIA provider env selects it", async () => {
    const { createH0xCliAdapter } = await import("./h0x-cli-adapter.js");
    const workingDir = join(TMP_ROOT, "cwd");
    const stateDir = join(TMP_ROOT, "state");
    mkdirSync(workingDir, { recursive: true });
    process.env.H0X_CLI_GAIA_PROVIDER = "gemini";
    delete process.env.H0X_CLI_GAIA_MODEL;
    delete process.env.ATOMIC_AGENT_GAIA_MODEL;
    spawnAgentRun.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
      timedOut: false,
      durationMs: 1,
    });
    parseCliOutput.mockReturnValue({
      reply: "FINAL ANSWER: gemini",
      sessionId: null,
      stepCount: 1,
      lastError: null,
    });

    await createH0xCliAdapter().runQuestion({
      row: {
        task_id: "fixture-3",
        Question: "Which provider?",
        Level: 1,
        "Final answer": "gemini",
        file_name: "",
        file_path: "",
      },
      workingDir,
      stateDir,
      prompt: "Question",
      maxSteps: 1,
      timeoutMs: 1000,
      chatUrl: "",
      embedUrl: null,
    });

    const seededConfig = readFileSync(join(stateDir, "config.json"), "utf8");
    expect(seededConfig).toContain('"activeTextProvider": "gemini"');
    expect(seededConfig).toContain('"activeEmbeddingProvider": "gemini"');
    expect(seededConfig).toContain('"kind": "gemini"');
    expect(seededConfig).toContain('"apiKeyEnvVar": "GEMINI_API_KEY"');
    expect(seededConfig).toContain('"defaultChatModel": "gemini-3.5-flash-lite"');
    expect(seededConfig).not.toContain("test-gemini-secret");
    expect(seededConfig).not.toContain("test-openrouter-secret");
  });

  it("labels the selected Gemini provider in adapter metadata", async () => {
    const { createH0xCliAdapter } = await import("./h0x-cli-adapter.js");
    process.env.H0X_CLI_GAIA_PROVIDER = "gemini";

    const adapter = createH0xCliAdapter();

    expect(adapter.label).toBe("h0x-cli (Gemini)");
  });

  it("accepts the legacy Gemini provider alias when the h0x provider env is unset", async () => {
    const { createH0xCliAdapter } = await import("./h0x-cli-adapter.js");
    delete process.env.H0X_CLI_GAIA_PROVIDER;
    process.env.ATOMIC_AGENT_GAIA_PROVIDER = "gemini";

    const adapter = createH0xCliAdapter();

    expect(adapter.label).toBe("h0x-cli (Gemini)");
    expect(adapter.probeRequirements()).toEqual([]);
  });

  it("uses the selected Gemini model without changing the OpenRouter default", async () => {
    const {
      DEFAULT_GAIA_OPENROUTER_MODEL,
      createH0xCliAdapter,
    } = await import("./h0x-cli-adapter.js");
    const workingDir = join(TMP_ROOT, "cwd");
    const stateDir = join(TMP_ROOT, "state");
    mkdirSync(workingDir, { recursive: true });
    process.env.H0X_CLI_GAIA_PROVIDER = "gemini";
    process.env.H0X_CLI_GAIA_MODEL = "gemini-test-flash";
    spawnAgentRun.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
      timedOut: false,
      durationMs: 1,
    });
    parseCliOutput.mockReturnValue({
      reply: "FINAL ANSWER: selected",
      sessionId: null,
      stepCount: 1,
      lastError: null,
    });

    await createH0xCliAdapter().runQuestion({
      row: {
        task_id: "fixture-4",
        Question: "Which model?",
        Level: 1,
        "Final answer": "selected",
        file_name: "",
        file_path: "",
      },
      workingDir,
      stateDir,
      prompt: "Question",
      maxSteps: 1,
      timeoutMs: 1000,
      chatUrl: "",
      embedUrl: null,
    });

    const seededConfig = readFileSync(join(stateDir, "config.json"), "utf8");
    expect(seededConfig).toContain('"defaultChatModel": "gemini-test-flash"');
    expect(seededConfig).not.toContain(DEFAULT_GAIA_OPENROUTER_MODEL);
    expect(DEFAULT_GAIA_OPENROUTER_MODEL).toBe("openai/gpt-4o-mini");
  });

  it("seeds NVIDIA NIM as an OpenAI-compatible GAIA provider", async () => {
    const { createH0xCliAdapter } = await import("./h0x-cli-adapter.js");
    const workingDir = join(TMP_ROOT, "cwd");
    const stateDir = join(TMP_ROOT, "state");
    mkdirSync(workingDir, { recursive: true });
    process.env.H0X_CLI_GAIA_PROVIDER = "nvidia";
    delete process.env.H0X_CLI_GAIA_MODEL;
    delete process.env.ATOMIC_AGENT_GAIA_MODEL;
    spawnAgentRun.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
      timedOut: false,
      durationMs: 1,
    });
    parseCliOutput.mockReturnValue({
      reply: "FINAL ANSWER: nvidia",
      sessionId: null,
      stepCount: 1,
      lastError: null,
    });

    await createH0xCliAdapter().runQuestion({
      row: {
        task_id: "fixture-nvidia",
        Question: "Which provider?",
        Level: 1,
        "Final answer": "nvidia",
        file_name: "",
        file_path: "",
      },
      workingDir,
      stateDir,
      prompt: "Question",
      maxSteps: 1,
      timeoutMs: 1000,
      chatUrl: "",
      embedUrl: null,
    });

    const seededConfig = readFileSync(join(stateDir, "config.json"), "utf8");
    expect(seededConfig).toContain('"activeTextProvider": "nvidia"');
    expect(seededConfig).toContain('"kind": "openai-compatible"');
    expect(seededConfig).toContain('"baseUrl": "https://integrate.api.nvidia.com/v1"');
    expect(seededConfig).toContain('"apiKeyEnvVar": "NVIDIA_API_KEY"');
    expect(seededConfig).toContain(
      '"defaultChatModel": "nvidia/nemotron-3-super-120b-a12b"',
    );
    expect(seededConfig).toContain('"analytics":');
    expect(seededConfig).toContain('"enabled": false');
    expect(seededConfig).not.toContain("test-nvidia-secret");
    expect(seededConfig).not.toContain("test-gemini-secret");
    expect(seededConfig).not.toContain("test-openrouter-secret");
  });

  it("labels and probes NVIDIA when selected", async () => {
    const { createH0xCliAdapter } = await import("./h0x-cli-adapter.js");
    process.env.H0X_CLI_GAIA_PROVIDER = "nvidia";
    process.env.NVIDIA_API_KEY = "";

    const adapter = createH0xCliAdapter();

    expect(adapter.label).toBe("h0x-cli (NVIDIA)");
    expect(adapter.probeRequirements()).toEqual(["NVIDIA_API_KEY"]);
  });

  it("passes NVIDIA DeepSeek thinking=false without applying it to other models", async () => {
    const { buildH0xGaiaConfig } = await import("./h0x-cli-adapter.js");

    const deepseek = buildH0xGaiaConfig(
      "deepseek-ai/deepseek-v4-pro-0813",
      "nvidia",
    );
    expect(deepseek.llm?.providers[0]).toMatchObject({
      extraBody: {
        chat_template_kwargs: {
          thinking: false,
        },
      },
    });

    const nemotron = buildH0xGaiaConfig(
      "nvidia/nemotron-3-super-120b-a12b",
      "nvidia",
    );
    expect(nemotron.llm?.providers[0]).not.toHaveProperty("extraBody");
  });

  it("seeds Azure OpenAI as an OpenAI-compatible GAIA provider", async () => {
    const { createH0xCliAdapter } = await import("./h0x-cli-adapter.js");
    const workingDir = join(TMP_ROOT, "cwd");
    const stateDir = join(TMP_ROOT, "state");
    mkdirSync(workingDir, { recursive: true });
    process.env.H0X_CLI_GAIA_PROVIDER = "azure";
    delete process.env.H0X_CLI_GAIA_MODEL;
    delete process.env.ATOMIC_AGENT_GAIA_MODEL;
    spawnAgentRun.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
      timedOut: false,
      durationMs: 1,
    });
    parseCliOutput.mockReturnValue({
      reply: "FINAL ANSWER: azure",
      sessionId: null,
      stepCount: 1,
      lastError: null,
    });

    await createH0xCliAdapter().runQuestion({
      row: {
        task_id: "fixture-azure",
        Question: "Which provider?",
        Level: 1,
        "Final answer": "azure",
        file_name: "",
        file_path: "",
      },
      workingDir,
      stateDir,
      prompt: "Question",
      maxSteps: 1,
      timeoutMs: 1000,
      chatUrl: "",
      embedUrl: null,
    });

    const seededConfig = readFileSync(join(stateDir, "config.json"), "utf8");
    expect(seededConfig).toContain('"activeTextProvider": "azure-openai"');
    expect(seededConfig).toContain('"kind": "openai-compatible"');
    expect(seededConfig).toContain(
      '"baseUrl": "https://judicialmindaifoundry.openai.azure.com/openai/v1"',
    );
    expect(seededConfig).toContain('"apiKeyEnvVar": "AZURE_OPENAI_API_KEY"');
    expect(seededConfig).toContain('"defaultChatModel": "gpt56testsolv2"');
    expect(seededConfig).toContain('"maxTokensField": "max_completion_tokens"');
    expect(seededConfig).toContain('"omitTemperature": true');
    expect(seededConfig).toContain('"analytics":');
    expect(seededConfig).toContain('"enabled": false');
    expect(seededConfig).not.toContain("test-azure-secret");
    expect(seededConfig).not.toContain("test-nvidia-secret");
    expect(seededConfig).not.toContain("test-gemini-secret");
    expect(seededConfig).not.toContain("test-openrouter-secret");
  });

  it("labels and probes Azure OpenAI when selected", async () => {
    const { createH0xCliAdapter } = await import("./h0x-cli-adapter.js");
    process.env.H0X_CLI_GAIA_PROVIDER = "azure";
    process.env.AZURE_OPENAI_API_KEY = "";

    const adapter = createH0xCliAdapter();

    expect(adapter.label).toBe("h0x-cli (Azure OpenAI)");
    expect(adapter.probeRequirements()).toEqual(["AZURE_OPENAI_API_KEY"]);
  });

  it("finalizes Azure max-step rows with tools disabled", async () => {
    const { createH0xCliAdapter } = await import("./h0x-cli-adapter.js");
    const workingDir = join(TMP_ROOT, "cwd");
    const stateDir = join(TMP_ROOT, "state");
    mkdirSync(workingDir, { recursive: true });
    mkdirSync(join(stateDir, "traces"), { recursive: true });
    writeFileSync(
      join(stateDir, "traces", "s-finalize.ndjson"),
      `${JSON.stringify({
        type: "prompt_captured",
        tail: "tool evidence says the answer is azure-recovered",
      })}\n`,
      "utf8",
    );
    process.env.H0X_CLI_GAIA_PROVIDER = "azure";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "FINAL ANSWER: azure-recovered",
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    spawnAgentRun.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 1,
      timedOut: false,
      durationMs: 12,
    });
    parseCliOutput.mockReturnValue({
      reply: "",
      sessionId: "s-finalize",
      stepCount: null,
      lastError: "max_steps_reached: 40 steps without reply",
    });
    collectTraceMetrics.mockResolvedValue({
      found: true,
      stepCount: 40,
      totalPromptTokens: 1000,
      totalPredictedTokens: 0,
      toolErrorCount: 3,
      turnFinished: true,
    });

    const result = await createH0xCliAdapter().runQuestion({
      row: {
        task_id: "fixture-finalize",
        Question: "Recover?",
        Level: 1,
        "Final answer": "azure-recovered",
        file_name: "",
        file_path: "",
      },
      workingDir,
      stateDir,
      prompt: "Question",
      maxSteps: 40,
      timeoutMs: 1000,
      chatUrl: "",
      embedUrl: null,
    });

    expect(result.error).toBeNull();
    expect(result.rawReply).toBe("FINAL ANSWER: azure-recovered");
    expect(result.metrics).toEqual(
      expect.objectContaining({
        stepCount: 40,
        recoveredFromMaxSteps: true,
        finalizationAttempted: true,
        finalizationFailed: false,
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      tools?: unknown;
      temperature?: unknown;
      max_completion_tokens?: unknown;
    };
    expect(body).not.toHaveProperty("tools");
    expect(body).not.toHaveProperty("temperature");
    expect(body.max_completion_tokens).toBe(128);
  });

  it("keeps Azure max-step errors visible when finalization fails", async () => {
    const { createH0xCliAdapter } = await import("./h0x-cli-adapter.js");
    const workingDir = join(TMP_ROOT, "cwd");
    const stateDir = join(TMP_ROOT, "state");
    mkdirSync(workingDir, { recursive: true });
    mkdirSync(join(stateDir, "traces"), { recursive: true });
    writeFileSync(
      join(stateDir, "traces", "s-finalize-fail.ndjson"),
      `${JSON.stringify({ type: "prompt_captured", tail: "context" })}\n`,
      "utf8",
    );
    process.env.H0X_CLI_GAIA_PROVIDER = "azure";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    spawnAgentRun.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 1,
      timedOut: false,
      durationMs: 12,
    });
    parseCliOutput.mockReturnValue({
      reply: "",
      sessionId: "s-finalize-fail",
      stepCount: null,
      lastError: "max_steps_reached: 40 steps without reply",
    });
    collectTraceMetrics.mockResolvedValue({
      found: true,
      stepCount: 40,
      totalPromptTokens: 1000,
      totalPredictedTokens: 0,
      toolErrorCount: 3,
      turnFinished: true,
    });

    const result = await createH0xCliAdapter().runQuestion({
      row: {
        task_id: "fixture-finalize-fail",
        Question: "Recover?",
        Level: 1,
        "Final answer": "azure-recovered",
        file_name: "",
        file_path: "",
      },
      workingDir,
      stateDir,
      prompt: "Question",
      maxSteps: 40,
      timeoutMs: 1000,
      chatUrl: "",
      embedUrl: null,
    });

    expect(result.error).toBe("max_steps_reached: 40 steps without reply");
    expect(result.metrics).toEqual(
      expect.objectContaining({
        recoveredFromMaxSteps: false,
        finalizationAttempted: true,
        finalizationFailed: true,
      }),
    );
  });

  it("classifies abnormal child exits as run errors", async () => {
    const { classifyH0xRunError } = await import("./h0x-cli-adapter.js");

    expect(
      classifyH0xRunError({
        cliLastError: null,
        exitCode: 3221226505,
        timedOut: false,
      }),
    ).toBe("process_exit_3221226505");
  });

  it("recovers metrics from one finished trace while keeping process exits visible", async () => {
    const { createH0xCliAdapter } = await import("./h0x-cli-adapter.js");
    const workingDir = join(TMP_ROOT, "cwd");
    const stateDir = join(TMP_ROOT, "state");
    mkdirSync(workingDir, { recursive: true });
    mkdirSync(join(stateDir, "traces"), { recursive: true });
    writeFileSync(join(stateDir, "traces", "trace-1.ndjson"), "{}\n", "utf8");
    spawnAgentRun.mockResolvedValue({
      stdout: "FINAL ANSWER: recovered",
      stderr: "",
      exitCode: 3221226505,
      timedOut: false,
      durationMs: 321,
    });
    parseCliOutput.mockReturnValue({
      reply: "FINAL ANSWER: recovered",
      sessionId: null,
      stepCount: null,
      lastError: null,
    });
    collectTraceMetrics.mockResolvedValue({
      found: true,
      stepCount: 1,
      totalPromptTokens: 42,
      totalPredictedTokens: 7,
      toolErrorCount: 0,
      turnFinished: true,
    });

    const result = await createH0xCliAdapter().runQuestion({
      row: {
        task_id: "fixture-process-exit",
        Question: "Recover metrics?",
        Level: 1,
        "Final answer": "recovered",
        file_name: "",
        file_path: "",
      },
      workingDir,
      stateDir,
      prompt: "Question",
      maxSteps: 1,
      timeoutMs: 1000,
      chatUrl: "",
      embedUrl: null,
    });

    expect(result.error).toBe("process_exit_3221226505");
    expect(result.metrics).toEqual(
      expect.objectContaining({
        stepCount: 1,
        promptTokens: 42,
        predictedTokens: 7,
        toolErrors: 0,
        recoveredFromTrace: true,
      }),
    );
  });
});
