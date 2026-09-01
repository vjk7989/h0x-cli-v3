import { describe, expect, it, vi } from "vitest";

import { describeImageViaOpenAi } from "./openai-describe-image.js";
import type { OpenAiHttpDeps } from "./openai-http.js";

function depsWith(fetchImpl: typeof fetch): OpenAiHttpDeps {
  return {
    baseUrl: "https://api.example.com",
    apiKey: "key",
    extraHeaders: {},
    requestTimeoutMs: 60_000,
    fetchImpl,
    label: "vision-test",
  };
}

function jsonResponse(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function firstBody(fetchImpl: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

describe("describeImageViaOpenAi", () => {
  it("uses max_tokens and temperature by default", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { content: "image" } }] }),
    );

    await describeImageViaOpenAi(
      depsWith(fetchImpl as unknown as typeof fetch),
      "vision-model",
      {
        prompt: "describe",
        images: [{ id: 1, bytes: new Uint8Array([1, 2, 3]), mimeType: "image/png" }],
      },
    );

    const body = firstBody(fetchImpl);
    expect(body.max_tokens).toBe(4096);
    expect(body.max_completion_tokens).toBeUndefined();
    expect(body.temperature).toBe(0.1);
  });

  it("uses max_completion_tokens for Azure-compatible deployments", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { content: "image" } }] }),
    );

    await describeImageViaOpenAi(
      depsWith(fetchImpl as unknown as typeof fetch),
      "vision-model",
      {
        prompt: "describe",
        maxTokens: 123,
        images: [{ id: 1, bytes: new Uint8Array([1]), mimeType: "image/png" }],
      },
      "/openai/v1",
      "max_completion_tokens",
    );

    const body = firstBody(fetchImpl);
    expect(body.max_completion_tokens).toBe(123);
    expect(body.max_tokens).toBeUndefined();
  });

  it("omits temperature when requested", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { content: "image" } }] }),
    );

    await describeImageViaOpenAi(
      depsWith(fetchImpl as unknown as typeof fetch),
      "vision-model",
      {
        prompt: "describe",
        images: [{ id: 1, bytes: new Uint8Array([1]), mimeType: "image/png" }],
      },
      "/v1",
      "max_completion_tokens",
      true,
    );

    expect(firstBody(fetchImpl).temperature).toBeUndefined();
  });

  it("keeps data image and prompt content intact", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { content: "image" } }] }),
    );

    await describeImageViaOpenAi(
      depsWith(fetchImpl as unknown as typeof fetch),
      "vision-model",
      {
        prompt: "what is on the board?",
        images: [{ id: 1, bytes: new Uint8Array([0xff, 0xd8, 0xff]), mimeType: "image/jpeg" }],
      },
    );

    const body = firstBody(fetchImpl) as {
      messages: Array<{
        content: Array<
          | { type: "image_url"; image_url: { url: string } }
          | { type: "text"; text: string }
        >;
      }>;
    };
    expect(body.messages[0]!.content[0]).toMatchObject({
      type: "image_url",
      image_url: { url: expect.stringMatching(/^data:image\/jpeg;base64,/) },
    });
    expect(body.messages[0]!.content[1]).toEqual({
      type: "text",
      text: "what is on the board?",
    });
  });
});
