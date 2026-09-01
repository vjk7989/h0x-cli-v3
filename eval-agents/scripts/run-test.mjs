#!/usr/bin/env node
// GAIA official test matrix. Run only when intentionally preparing a leaderboard submission.

import {
  bringUpDaemons,
  installSignalHandlers,
  loadEnv,
  makeLog,
  readEvalEnv,
  runVitest,
  teardownDaemons,
} from "./_lib.mjs";

const log = makeLog("test");
installSignalHandlers(log);

async function main() {
  loadEnv();
  const allow = readEvalEnv("H0X_CLI_GAIA_ALLOW_TEST_RUN", "ATOMIC_AGENT_GAIA_ALLOW_TEST_RUN");
  if (allow !== "1") {
    log("refusing official test split without H0X_CLI_GAIA_ALLOW_TEST_RUN=1");
    return 2;
  }

  const agents =
    readEvalEnv("H0X_CLI_EVAL_AGENTS", "ATOMIC_AGENT_EVAL_AGENTS") ?? "";
  const agentIds = agents.split(",").map((s) => s.trim()).filter(Boolean);
  const needsLocalDaemon =
    agentIds.length === 0 || agentIds.some((id) => id !== "h0x-cli");
  const daemon = needsLocalDaemon
    ? await bringUpDaemons(log)
    : { chatUrl: "openrouter://h0x-cli", embedUrl: null, startedByUs: false };

  if (!daemon.chatUrl) {
    log("no chat llama URL");
    return 2;
  }

  const extraEnv = {
    H0X_CLI_EVAL_LLAMA_URL: daemon.chatUrl,
    ATOMIC_AGENT_EVAL_LLAMA_URL: daemon.chatUrl,
    H0X_CLI_GAIA_SOURCE: "hf",
    ATOMIC_AGENT_GAIA_SOURCE: "hf",
    H0X_CLI_GAIA_SPLIT: "test",
    ATOMIC_AGENT_GAIA_SPLIT: "test",
    H0X_CLI_GAIA_MAX_STEPS:
      readEvalEnv("H0X_CLI_GAIA_MAX_STEPS", "ATOMIC_AGENT_GAIA_MAX_STEPS") ?? "40",
    H0X_CLI_GAIA_TIMEOUT_MS:
      readEvalEnv("H0X_CLI_GAIA_TIMEOUT_MS", "ATOMIC_AGENT_GAIA_TIMEOUT_MS") ?? "900000",
  };
  const limit = readEvalEnv("H0X_CLI_GAIA_LIMIT", "ATOMIC_AGENT_GAIA_LIMIT");
  if (limit) {
    extraEnv.H0X_CLI_GAIA_LIMIT = limit;
    extraEnv.ATOMIC_AGENT_GAIA_LIMIT = limit;
  }
  if (daemon.embedUrl) {
    extraEnv.H0X_CLI_EVAL_EMBED_URL = daemon.embedUrl;
    extraEnv.ATOMIC_AGENT_EVAL_EMBED_URL = daemon.embedUrl;
  }

  let code = 1;
  try {
    code = await runVitest({ extraEnv, forwarded: process.argv.slice(2) });
  } finally {
    teardownDaemons(log, daemon.startedByUs);
  }
  return code;
}

main()
  .then((c) => process.exit(c))
  .catch((err) => {
    log(`fatal: ${err?.stack ?? err}`);
    process.exit(1);
  });
