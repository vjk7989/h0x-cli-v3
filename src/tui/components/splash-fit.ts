export type LogoVariant = "full" | "small" | "mini" | "tiny";
export type LogoChoice = LogoVariant | "none";
export type WordmarkPlacement = "beside" | "below" | "none";
export type TipDescriptions = "full" | "short" | "none";
export interface SplashSize { columns: number; rows: number }
export interface SplashFit {
  logo: LogoChoice;
  wordmarkPlacement: WordmarkPlacement;
  wordmark: boolean;
  tagline: boolean;
  infoRows: number;
  tipCount: number;
  labelWidth: number;
  descriptions: TipDescriptions;
}
export interface SplashTip {
  label: string;
  description: string;
  short: string;
  command: string;
}
export const SPLASH_TIPS: readonly SplashTip[] = [
  { label: "/help", description: "list all slash commands", short: "all commands", command: "/help" },
  { label: "/sessions", description: "switch to a previous thread", short: "past threads", command: "/sessions" },
  { label: "/new", description: "start a fresh session", short: "new session", command: "/new" },
  { label: "/model", description: "change the chat model", short: "pick model", command: "/model" },
  { label: "/tasks", description: "jump to the Tasks tab", short: "Tasks tab", command: "/tasks" },
  { label: "/import", description: "open the Import tab", short: "Hermes import", command: "/import" },
];
export const LOGO_METRICS = {
  full: { width: 82, height: 7 },
  small: { width: 47, height: 7 },
  mini: { width: 7, height: 1 },
  tiny: { width: 7, height: 1 },
} as const;
export const WORDMARK_WIDTH = 7;
export const WORDMARK_STACK_ROWS = 1;

/** Reserve context first; only spend remaining rows on artwork and tips. */
export function computeSplashFit(size: SplashSize, metadataRows = 6): SplashFit {
  const inner = Math.max(0, Math.floor(size.columns) - 4);
  const rows = Math.max(0, Math.floor(size.rows));
  const available = Math.max(0, rows - 1);
  const infoRows = inner > 0 ? Math.min(metadataRows, available) : 0;
  const logo: LogoChoice = (["full", "small"] as const).find((variant) => {
    const metrics = LOGO_METRICS[variant];
    return metrics.width <= inner && metrics.height + 1 + infoRows <= available;
  }) ?? "none";
  const artRows = logo === "none" ? 0 : LOGO_METRICS[logo].height + 1;
  const tipCount = inner >= 5
    ? Math.max(0, Math.min(SPLASH_TIPS.length, available - artRows - infoRows - 1))
    : 0;
  const visible = SPLASH_TIPS.slice(0, tipCount);
  const labelWidth = Math.max(0, ...visible.map((tip) => tip.label.length + 1));
  const budget = inner - 4 - labelWidth;
  const descriptions: TipDescriptions = visible.every((tip) => tip.description.length <= budget)
    ? "full"
    : visible.every((tip) => tip.short.length <= budget) ? "short" : "none";
  return {
    logo, wordmarkPlacement: "none", wordmark: false, tagline: false,
    infoRows, tipCount, labelWidth: descriptions === "none" ? 0 : labelWidth,
    descriptions,
  };
}
