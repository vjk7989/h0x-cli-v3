import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { fakeSession } from "../test-fixtures.js";
import { createInitialTuiState, type TuiState } from "../tui-state.js";
import { ChatLog } from "./chat-log.js";

vi.mock("../hooks/use-git-context.js", () => ({ useGitContext: () => null }));

describe("ChatLog welcome model transitions", () => {
  it("replaces local metadata with the active cloud model and clears an unconfigured model", async () => {
    const initial = createInitialTuiState(fakeSession({ workingDir: "G:/work" }));
    const local: TuiState = {
      ...initial,
      llmHealth: { ...initial.llmHealth, model: "local-model.gguf" },
    };
    const cloud: TuiState = {
      ...local,
      providersPanel: {
        ...local.providersPanel,
        rows: [{ id: "openrouter", kind: "openrouter", isActiveText: true,
          isActiveEmbedding: false, hasApiKey: true, chatModel: "provider/cloud-model",
          embeddingModel: null }],
      },
    };
    const unconfigured: TuiState = {
      ...cloud,
      providersPanel: {
        ...cloud.providersPanel,
        rows: cloud.providersPanel.rows.map((row) => ({ ...row, chatModel: null })),
      },
    };
    const view = render(<ChatLog state={local} />);
    const frame = (): string => (view.lastFrame() ?? "").replace(/\u001b\[[0-9;]*m/g, "");
    try {
      expect(frame()).toContain("model: local-model.gguf");
      view.rerender(<ChatLog state={cloud} />);
      await vi.waitFor(() => expect(frame()).toContain("model: provider/cloud-model"));
      expect(frame()).not.toContain("local-model.gguf");
      view.rerender(<ChatLog state={unconfigured} />);
      await vi.waitFor(() => expect(frame()).toContain("model: not configured"));
      expect(frame()).not.toContain("provider/cloud-model");
      expect(frame()).not.toContain("local-model.gguf");
      expect(frame()).toContain("directory: G:/work");
      expect(frame()).toContain("h0x-cli");
    } finally {
      view.unmount();
    }
  });
});
