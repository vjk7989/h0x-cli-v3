import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { useTypewriter } from "../hooks/use-typewriter.js";
import type { OnboardingFit } from "../onboarding/onboarding-fit.js";
import { theme } from "../theme/theme.js";
import { Logo, TAGLINE } from "./logo.js";
import { computeSplashFit } from "./splash-fit.js";

export const TAGLINE_MS_PER_CHAR = 45;
export const INTRO_CHROME_ROWS = 6;

/** Keep the existing first-run key flow, with the same identity as empty chat. */
export function OnboardingIntroStep(props: {
  columns: number;
  rows: number;
  fit: OnboardingFit;
  skipAnimation: boolean;
}): ReactElement {
  const fit = computeSplashFit({ columns: props.columns + 4, rows: props.rows }, 5);
  const { revealed } = useTypewriter(TAGLINE, {
    active: true, msPerChar: TAGLINE_MS_PER_CHAR, skip: props.skipAnimation,
  });
  const info = ["h0x-cli", revealed, "https://pavii.tech", "docs (placeholder): https://pavii.tech/docs", "[ press any key to continue ]"];
  return (
    <Box flexDirection="column" width={props.columns} height={props.rows} alignItems="center" justifyContent="center">
      {fit.logo !== "none" ? <Logo variant={fit.logo} wordmark={false} tagline={false} /> : null}
      <Box flexDirection="column" width="100%" marginTop={fit.logo === "none" ? 0 : 1}>
        {info.slice(0, fit.infoRows).map((line, index) => (
          <Text key={index} color={index === 0 ? theme.colors.brandMark : theme.colors.muted} bold={index === 0} wrap="truncate-middle">
            {line || " "}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
