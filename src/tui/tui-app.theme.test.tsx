import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAtSize } from "./test-sized-render.js";
import { fakeSession } from "./test-fixtures.js";
import { makeTuiEventBus, TuiApp, type TuiAppCallbacks } from "./tui-app.js";
import { getActiveTheme, getActiveThemeName, setActiveTheme, THEMES, theme } from "./theme/theme.js";

vi.mock("./hooks/use-git-context.js", () => ({ useGitContext: () => null }));

const originalTheme = getActiveTheme();
let originalTty: PropertyDescriptor | undefined;

beforeEach(() => {
  originalTty = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
  Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
  setActiveTheme(THEMES["classic-dark"]);
});

afterEach(() => {
  setActiveTheme(originalTheme);
  if (originalTty) Object.defineProperty(process.stdout, "isTTY", originalTty);
  else delete (process.stdout as { isTTY?: boolean }).isTTY;
});

describe("theme picker persistence", () => {
  it("previews without saving, applies once, and cancels back to the applied palette", async () => {
    const bus = makeTuiEventBus();
    const subscribed = vi.spyOn(bus, "subscribe");
    const persist = vi.fn();
    const callbacks: TuiAppCallbacks = {
      onApprovalDecision: vi.fn(), onAbort: vi.fn(), onQuit: vi.fn(),
      onMessageSubmitted: vi.fn(), onThemePersistRequested: persist,
    };
    const view = renderAtSize(<TuiApp session={fakeSession({ workingDir: "G:/work" })}
      bus={bus} callbacks={callbacks} />, { columns: 120, rows: 40 });
    const frame = (): string => (view.lastFrame() ?? "").replace(/\u001b\[[0-9;]*m/g, "");
    try {
      await vi.waitFor(() => expect(subscribed).toHaveBeenCalledOnce());
      bus.emit({ type: "theme_picker_opened" });
      await vi.waitFor(() => expect(frame()).toContain("themes (6)"));
      view.stdin.write("\u001b[B");
      await vi.waitFor(() => expect(getActiveThemeName()).toBe("classic-light"));
      await vi.waitFor(() => expect(frame().split("\n").find((row) => row.includes("classic-light")))
        .toContain(theme.glyphs.chevronRight));
      expect(theme.colors.brandMark).toBe("#6b35b5");
      expect(persist).not.toHaveBeenCalled();
      view.stdin.write("\r");
      await vi.waitFor(() => expect(persist).toHaveBeenCalledWith("classic-light"));
      expect(persist).toHaveBeenCalledTimes(1);
      await vi.waitFor(() => expect(frame()).not.toContain("themes (6)"));

      bus.emit({ type: "theme_picker_opened" });
      await vi.waitFor(() => expect(frame()).toContain("themes (6)"));
      view.stdin.write("\u001b[B");
      await vi.waitFor(() => expect(getActiveThemeName()).toBe("toxic-green"));
      await vi.waitFor(() => expect(frame().split("\n").find((row) => row.includes("toxic-green")))
        .toContain(theme.glyphs.chevronRight));
      expect(theme.colors.brandMark).toBe(THEMES["toxic-green"].colors.accent);
      expect(persist).toHaveBeenCalledTimes(1);
      view.stdin.write("\u001b");
      await vi.waitFor(() => expect(frame()).not.toContain("themes (6)"));
      expect(getActiveThemeName()).toBe("classic-light");
      expect(theme.colors.brandMark).toBe("#6b35b5");
      expect(persist).toHaveBeenCalledTimes(1);
      expect(persist).toHaveBeenCalledWith("classic-light");
      expect(callbacks.onMessageSubmitted).not.toHaveBeenCalled();
    } finally {
      view.unmount();
      subscribed.mockRestore();
    }
  });
});
