import { describe, expect, it } from "vitest";

import { buildOpenAiChatBody } from "./openai-build-body.js";

describe("buildOpenAiChatBody", () => {
  it("uses max_tokens by default", () => {
    const body = buildOpenAiChatBody(
      { prompt: "hello", maxTokens: 123 },
      "model-a",
      false,
    );

    expect(body.max_tokens).toBe(123);
    expect(body).not.toHaveProperty("max_completion_tokens");
  });

  it("can use max_completion_tokens for compatible deployments", () => {
    const body = buildOpenAiChatBody(
      { prompt: "hello", maxTokens: 456 },
      "model-a",
      false,
      undefined,
      "max_completion_tokens",
    );

    expect(body.max_completion_tokens).toBe(456);
    expect(body).not.toHaveProperty("max_tokens");
  });

  it("can omit temperature for deployments that reject sampling controls", () => {
    const body = buildOpenAiChatBody(
      { prompt: "hello", maxTokens: 456 },
      "model-a",
      false,
      undefined,
      "max_completion_tokens",
      true,
    );

    expect(body.max_completion_tokens).toBe(456);
    expect(body).not.toHaveProperty("temperature");
  });
});
