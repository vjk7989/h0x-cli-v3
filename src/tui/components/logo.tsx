import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { theme } from "../theme/theme.js";
import { FULL_H0X_ART, SMALL_H0X_ART, H0X_RAIL_ART } from "./h0x-art.js";
import type { LogoVariant, WordmarkPlacement } from "./splash-fit.js";

export interface LogoProps {
  variant?: LogoVariant;
  compact?: boolean;
  wordmark?: boolean;
  tagline?: boolean;
  placement?: WordmarkPlacement;
}
export const LOGO_ART: Readonly<Record<LogoVariant, readonly string[]>> = {
  full: FULL_H0X_ART,
  small: SMALL_H0X_ART,
  mini: ["h0x-cli"],
  tiny: ["h0x-cli"],
};
export const RAIL_MARK = H0X_RAIL_ART;
export const WORDMARK_ROWS = ["h0x-cli"] as const;
export const TAGLINE = "Built by TEAM PAVii.Ai";

export function Logo({
  variant = "full", compact = false, wordmark = !compact, tagline = !compact,
}: LogoProps): ReactElement {
  return (
    <Box flexDirection="column" alignItems="center" flexShrink={0}>
      {LOGO_ART[variant].map((row, index) => (
        <Text key={index} color={theme.colors.brandMark} bold wrap="truncate">{row}</Text>
      ))}
      {wordmark && variant !== "tiny" && variant !== "mini" ? (
        <Text color={theme.colors.brandMark} bold>h0x-cli</Text>
      ) : null}
      {tagline ? <Text color={theme.colors.muted} wrap="truncate">{TAGLINE}</Text> : null}
    </Box>
  );
}
