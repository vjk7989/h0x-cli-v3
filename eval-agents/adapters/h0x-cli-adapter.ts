import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { spawnAgentRun } from "../../eval/harness/spawn-agent.js";
import { parseCliOutput } from "../../eval/harness/parse-cli-output.js";
import { collectTraceMetrics } from "../../eval/harness/parse-trace-metrics.js";
import {
  USER_CONFIG_DEFAULTS,
  USER_CONFIG_VERSION,
  type UserConfigFile,
} from "../../src/config/config-schema.js";

import type { AgentAdapter, GaiaAgentRunContext, GaiaAgentRawRun } from "../harness/agent-adapter.js";
import { readEvalEnv } from "../harness/env-aliases.js";

export const DEFAULT_GAIA_OPENROUTER_MODEL = "openai/gpt-4o-mini";
export const DEFAULT_GAIA_GEMINI_MODEL = "gemini-3.5-flash-lite";
export const DEFAULT_GAIA_NVIDIA_MODEL = "nvidia/nemotron-3-super-120b-a12b";
export const DEFAULT_GAIA_AZURE_MODEL = "gpt56testsolv2";
export const NVIDIA_NIM_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const AZURE_OPENAI_BASE_URL =
  "https://judicialmindaifoundry.openai.azure.com/openai/v1";
const GAIA_FINALIZER_MAX_TAIL_CHARS = 60_000;
const GAIA_FINALIZER_TIMEOUT_MS = 120_000;
export type H0xGaiaProvider = "openrouter" | "gemini" | "nvidia" | "azure";

export function resolveH0xGaiaProvider(): H0xGaiaProvider {
  const raw = readEvalEnv("H0X_CLI_GAIA_PROVIDER", "ATOMIC_AGENT_GAIA_PROVIDER");
  if (raw === "azure") return "azure";
  if (raw === "nvidia") return "nvidia";
  return raw === "gemini" ? "gemini" : "openrouter";
}

export function resolveGaiaOpenRouterModel(): string {
  return (
    readEvalEnv("H0X_CLI_GAIA_MODEL", "ATOMIC_AGENT_GAIA_MODEL") ??
    DEFAULT_GAIA_OPENROUTER_MODEL
  );
}

export function resolveGaiaGeminiModel(): string {
  return (
    readEvalEnv("H0X_CLI_GAIA_MODEL", "ATOMIC_AGENT_GAIA_MODEL") ??
    DEFAULT_GAIA_GEMINI_MODEL
  );
}

export function resolveGaiaNvidiaModel(): string {
  return (
    readEvalEnv("H0X_CLI_GAIA_MODEL", "ATOMIC_AGENT_GAIA_MODEL") ??
    DEFAULT_GAIA_NVIDIA_MODEL
  );
}

export function resolveGaiaAzureModel(): string {
  return (
    readEvalEnv("H0X_CLI_GAIA_MODEL", "ATOMIC_AGENT_GAIA_MODEL") ??
    DEFAULT_GAIA_AZURE_MODEL
  );
}

export function resolveH0xGaiaModel(provider: H0xGaiaProvider): string {
  if (provider === "azure") return resolveGaiaAzureModel();
  if (provider === "gemini") return resolveGaiaGeminiModel();
  if (provider === "nvidia") return resolveGaiaNvidiaModel();
  return resolveGaiaOpenRouterModel();
}

export function buildH0xGaiaConfig(
  model: string,
  provider: H0xGaiaProvider = "openrouter",
): UserConfigFile {
  const config: UserConfigFile = JSON.parse(JSON.stringify(USER_CONFIG_DEFAULTS));
  config.version = USER_CONFIG_VERSION;
  config.agent = {
    ...config.agent,
    approvalLevel: 5,
  };
  const providerEntry =
    provider === "gemini"
      ? {
          id: "gemini",
          kind: "gemini",
          apiKeyEnvVar: "GEMINI_API_KEY",
          defaultChatModel: model,
          supportsTools: true,
          supportsVision: true,
        }
      : provider === "nvidia"
        ? {
          id: "nvidia",
          kind: "openai-compatible",
          baseUrl: NVIDIA_NIM_BASE_URL,
          apiKeyEnvVar: "NVIDIA_API_KEY",
            defaultChatModel: model,
            supportsTools: true,
          supportsVision: false,
          ...buildNvidiaGaiaProviderOverrides(model),
        }
      : provider === "azure"
        ? {
            id: "azure-openai",
            kind: "openai-compatible",
            baseUrl: AZURE_OPENAI_BASE_URL,
            apiKeyEnvVar: "AZURE_OPENAI_API_KEY",
            defaultChatModel: model,
            supportsTools: true,
            supportsVision: true,
            maxTokensField: "max_completion_tokens" as const,
            omitTemperature: true,
          }
      : {
          id: "openrouter",
          kind: "openrouter",
          apiKeyEnvVar: "OPENROUTER_API_KEY",
          defaultChatModel: model,
          supportsTools: true,
          supportsVision: true,
        };
  config.llm = {
    activeTextProvider: providerEntry.id,
    activeEmbeddingProvider: providerEntry.id,
    toolTransport: "auto",
    providers: [providerEntry],
  };
  config.memory = {
    ...config.memory,
    embeddings: {
      ...config.memory.embeddings,
      enabled: false,
    },
  };
  config.localModels = {
    ...config.localModels,
    embeddings: {
      ...config.localModels.embeddings,
      enabled: false,
    },
  };
  config.analytics = {
    ...config.analytics,
    enabled: false,
  };
  config.tracing = {
    ...config.tracing,
    trace: {
      ...config.tracing.trace,
      enabled: true,
      maxBytesPerSession: 200 * 1024 * 1024,
    },
  };
  return config;
}

function buildNvidiaGaiaProviderOverrides(model: string): Record<string, unknown> {
  if (!model.startsWith("deepseek-ai/deepseek-v4-pro")) return {};
  return {
    extraBody: {
      chat_template_kwargs: {
        thinking: false,
      },
    },
  };
}

export function seedH0xGaiaConfig(
  stateDir: string,
  model: string,
  provider: H0xGaiaProvider = "openrouter",
): UserConfigFile {
  mkdirSync(stateDir, { recursive: true });
  const config = buildH0xGaiaConfig(model, provider);
  writeFileSync(join(stateDir, "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return config;
}

export function createH0xCliAdapter(): AgentAdapter {
  const provider = resolveH0xGaiaProvider();
  return {
    id: "h0x-cli",
    label:
      provider === "gemini"
        ? "h0x-cli (Gemini)"
        : provider === "nvidia"
          ? "h0x-cli (NVIDIA)"
          : provider === "azure"
            ? "h0x-cli (Azure OpenAI)"
          : "h0x-cli (OpenRouter)",
    probeRequirements() {
      const missing: string[] = [];
      const provider = resolveH0xGaiaProvider();
      if (provider === "gemini" && !process.env.GEMINI_API_KEY?.trim()) {
        missing.push("GEMINI_API_KEY");
      }
      if (provider === "openrouter" && !process.env.OPENROUTER_API_KEY?.trim()) {
        missing.push("OPENROUTER_API_KEY");
      }
      if (provider === "nvidia" && !process.env.NVIDIA_API_KEY?.trim()) {
        missing.push("NVIDIA_API_KEY");
      }
      if (provider === "azure" && !process.env.AZURE_OPENAI_API_KEY?.trim()) {
        missing.push("AZURE_OPENAI_API_KEY");
      }
      return missing;
    },
    async runQuestion(ctx: GaiaAgentRunContext): Promise<GaiaAgentRawRun> {
      const provider = resolveH0xGaiaProvider();
      seedH0xGaiaConfig(ctx.stateDir, resolveH0xGaiaModel(provider), provider);

      const spawn = await spawnAgentRun({
        workingDir: ctx.workingDir,
        stateDir: ctx.stateDir,
        prompt: ctx.prompt,
        maxSteps: ctx.maxSteps,
        timeoutMs: ctx.timeoutMs,
        requireDist: true,
      });

      const cli = parseCliOutput(spawn.stdout, spawn.stderr);
      let stepCount: number | null = cli.stepCount;
      let promptTokens: number | null = null;
      let predictedTokens: number | null = null;
      let toolErrors: number | null = null;
      let recoveredFromTrace = false;
      let recoveredFromMaxSteps = false;
      let finalizationAttempted = false;
      let finalizationFailed = false;

      if (cli.sessionId) {
        const tracePath = join(ctx.stateDir, "traces", `${cli.sessionId}.ndjson`);
        const metrics = await collectTraceMetrics(tracePath);
        stepCount = metrics.stepCount;
        promptTokens = metrics.totalPromptTokens;
        predictedTokens = metrics.totalPredictedTokens;
        toolErrors = metrics.toolErrorCount;
      } else {
        const tracePath = findSingleTracePath(ctx.stateDir);
        if (tracePath) {
          const metrics = await collectTraceMetrics(tracePath);
          if (metrics.found && metrics.turnFinished) {
            stepCount = metrics.stepCount;
            promptTokens = metrics.totalPromptTokens;
            predictedTokens = metrics.totalPredictedTokens;
            toolErrors = metrics.toolErrorCount;
            recoveredFromTrace = true;
          }
        }
      }

      let rawReply = cli.reply;
      let error = classifyH0xRunError({
        cliLastError: cli.lastError,
        exitCode: spawn.exitCode,
        timedOut: spawn.timedOut,
      });

      if (provider === "azure" && isMaxStepsError(error) && !rawReply.trim()) {
        finalizationAttempted = true;
        const finalized = await finalizeAzureMaxSteps(ctx.stateDir, resolveGaiaAzureModel());
        if (finalized) {
          rawReply = finalized;
          error = null;
          recoveredFromMaxSteps = true;
        } else {
          finalizationFailed = true;
        }
      }

      return {
        rawReply,
        exitCode: spawn.exitCode,
        timedOut: spawn.timedOut,
        error,
        metrics: {
          stepCount,
          promptTokens,
          predictedTokens,
          toolErrors,
          recoveredFromTrace,
          recoveredFromMaxSteps,
          finalizationAttempted,
          finalizationFailed,
          wallClockMs: spawn.durationMs,
          timedOut: spawn.timedOut,
          exitCode: spawn.exitCode,
        },
      };
    },
  };
}

function isMaxStepsError(error: string | null): boolean {
  return /max_steps_reached/i.test(error ?? "");
}

async function finalizeAzureMaxSteps(
  stateDir: string,
  model: string,
): Promise<string | null> {
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const tail = readLatestPromptTail(stateDir);
  if (!tail) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GAIA_FINALIZER_TIMEOUT_MS);
  try {
    const res = await fetch(`${AZURE_OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: buildFinalizationPrompt(tail),
          },
        ],
        max_completion_tokens: 128,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: unknown; tool_calls?: unknown } }>;
    };
    const message = json.choices?.[0]?.message;
    if (!message || message.tool_calls !== undefined) return null;
    const content = typeof message.content === "string" ? message.content.trim() : "";
    if (!content) return null;
    return content;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function readLatestPromptTail(stateDir: string): string | null {
  const tracePath = findSingleTracePath(stateDir);
  if (!tracePath) return null;
  const lines = readFileSync(tracePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const event = JSON.parse(lines[i] ?? "{}") as { type?: unknown; tail?: unknown };
      if (event.type === "prompt_captured" && typeof event.tail === "string") {
        return event.tail.slice(-GAIA_FINALIZER_MAX_TAIL_CHARS);
      }
    } catch {
      // Ignore malformed trace lines; traces are best-effort evidence.
    }
  }
  return null;
}

function buildFinalizationPrompt(tail: string): string {
  return [
    "You are finalizing a GAIA benchmark question after the agent exhausted its tool step limit.",
    "Use only the conversation and tool evidence below.",
    "Do not call tools, ask follow-up questions, or add explanation.",
    "Return exactly one line in this format: FINAL ANSWER: <answer>",
    "Context:",
    tail,
  ].join("\n\n");
}

function findSingleTracePath(stateDir: string): string | null {
  const traceDir = join(stateDir, "traces");
  let entries: string[];
  try {
    entries = readdirSync(traceDir);
  } catch {
    return null;
  }
  const traces = entries.filter((entry) => entry.endsWith(".ndjson"));
  if (traces.length !== 1) return null;
  return join(traceDir, traces[0] ?? "");
}

export function classifyH0xRunError(input: {
  cliLastError: string | null;
  exitCode: number | null;
  timedOut: boolean;
}): string | null {
  if (input.cliLastError) return input.cliLastError;
  if (input.timedOut) return "timeout";
  if (input.exitCode !== null && input.exitCode !== 0) {
    return `process_exit_${input.exitCode}`;
  }
  return null;
}
