import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { useTerminalSize } from "../hooks/use-terminal-size.js";
import { computeChatViewportRows, computeChatWidth } from "../layout.js";
import { MouseTarget, useMouseCommands } from "../mouse/mouse-context.js";
import { isPrimaryPress } from "../mouse/mouse-event.js";
import { theme } from "../theme/theme.js";
import { Logo, TAGLINE } from "./logo.js";
import { getAppVersion } from "../../version.js";
import type { GitContext } from "../read-git-context.js";
import {
  computeSplashFit,
  SPLASH_TIPS,
  type SplashFit,
  type SplashSize,
  type SplashTip,
  type TipDescriptions,
} from "./splash-fit.js";

/**
 * Empty-chat identity and live context. The fit reserves metadata before
 * artwork and tips so a small terminal keeps the working context visible.
 */
export interface SplashBannerProps {
  model?: string | null;
  workingDir?: string;
  git?: GitContext | null;
  /**
   * Explicit surface size, bypassing the terminal measurement. Only
   * used by tests — ink-testing-library's stdout stub reports a fixed
   * 100×0, which would pin every rendered frame to one breakpoint.
   */
  size?: SplashSize;
}

export function SplashBanner({ size, model, workingDir, git }: SplashBannerProps = {}): ReactElement {
  const terminal = useTerminalSize();
  const surface: SplashSize = size ?? {
    columns: computeChatWidth(terminal.columns, terminal.rows),
    rows: computeChatViewportRows(terminal.rows, terminal.columns),
  };
  const info = [
    `h0x-cli v${getAppVersion()}`,
    `model: ${model?.trim() || "not configured"}`,
    `directory: ${workingDir ?? process.cwd()}`,
    ...(git ? [`git: ${git.name} (${git.branch})`] : []),
    TAGLINE,
    "https://pavii.tech",
    "docs (placeholder): https://pavii.tech/docs",
  ].map((line) => line.replace(/[\x00-\x1f\x7f-\x9f]/g, ""));
  const fit = computeSplashFit(surface, info.length);
  const tips = SPLASH_TIPS.slice(0, fit.tipCount);
  return (
    <Box flexDirection="column" width={surface.columns} flexGrow={1} alignItems="center" paddingX={2}>
      <Box flexGrow={1} />
      {fit.logo === "none" ? null : (
        <Logo
          variant={fit.logo}
          wordmark={fit.wordmark}
          tagline={fit.tagline}
          placement={fit.wordmarkPlacement}
        />
      )}
      {fit.infoRows > 0 ? (
        <Box flexDirection="column" width="100%" marginTop={fit.logo === "none" ? 0 : 1}>
          {info.slice(0, fit.infoRows).map((line, index) => (
            <Text key={index} color={index === 0 ? theme.colors.brandMark : theme.colors.muted} bold={index === 0} wrap="truncate-middle">
              {line}
            </Text>
          ))}
        </Box>
      ) : null}
      {tips.length > 0 ? (
        <Box
          marginTop={1}
          flexDirection="column"
        >
          {tips.map((tip) => (
            <Tip key={tip.label} tip={tip} fit={fit} />
          ))}
        </Box>
      ) : null}
      <Box flexGrow={1} />
    </Box>
  );
}

interface TipProps {
  tip: SplashTip;
  fit: SplashFit;
}

function Tip({ tip, fit }: TipProps): ReactElement {
  const label =
    fit.labelWidth > 0 ? tip.label.padEnd(fit.labelWidth, " ") : tip.label;
  const mouse = useMouseCommands();
  const row = (
    <Text wrap="truncate">
      <Text color={theme.colors.muted}>  {theme.glyphs.bullet} </Text>
      <Text color={theme.colors.accent}>{label}</Text>
      <Text color={theme.colors.muted}>{description(tip, fit.descriptions)}</Text>
    </Text>
  );
  if (!mouse) return row;
  return (
    <MouseTarget
      flexShrink={0}
      onMouse={(hit) => {
        if (!isPrimaryPress(hit.event)) return false;
        // Put the command in the composer rather than running it: the
        // row is a suggestion, and Enter is the operator's to press.
        // `/model` and friends take arguments, and a click that fired
        // them outright would rob a mis-click of its undo.
        if (mouse.getState().chatFocus !== "editor") {
          mouse.dispatch({ type: "chat_focus_set", focus: "editor" });
        }
        // Trailing space, matching the palette's own completion: it
        // leaves the caret past the command and keeps `slashPrefix`
        // from re-opening the palette over the buffer we just seeded.
        mouse.dispatch({ type: "input_changed", value: `${tip.command} ` });
        return true;
      }}
    >
      {row}
    </MouseTarget>
  );
}

function description(tip: SplashTip, mode: TipDescriptions): string {
  if (mode === "full") return tip.description;
  if (mode === "short") return tip.short;
  return "";
}
