import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Standalone opt-in suite: existing dist is required, never built or substituted.
export default defineConfig({
  root: fileURLToPath(new URL("../", import.meta.url)),
  test: {
    include: [
      "audit/telemetry.network-audit.test.ts",
      "audit/provider-loopback.network-audit.test.ts",
    ],
    environment: "node",
    setupFiles: ["src/test-setup.ts"],
    testTimeout: 15_000,
  },
});
