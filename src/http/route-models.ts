import { sendJson, type HttpHandler } from "./request-context.js";
import { APP_MACHINE_NAME } from "../brand/index.js";

/**
 * `GET /v1/models` — OpenAI-compatible model catalog. h0x-cli is
 * a single-model front for whatever model the external llama-server
 * has loaded, so we advertise one synthetic entry. The `created`
 * field is pinned so lazy caches keyed on it stay stable.
 */
const MODEL_CREATED = 1_700_000_000;

export function createModelsHandler(): HttpHandler {
  return async (_req, res) => {
    sendJson(res, 200, {
      object: "list",
      data: [
        {
          id: APP_MACHINE_NAME,
          object: "model",
          created: MODEL_CREATED,
          owned_by: APP_MACHINE_NAME,
        },
      ],
    });
  };
}
