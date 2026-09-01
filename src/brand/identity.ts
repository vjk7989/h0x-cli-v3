import { getAppVersion } from "../version.js";

export const APP_MACHINE_NAME = "h0x-cli";
export const APP_DISPLAY_NAME = "h0x-cli by PAVii.Ai";
export const APP_WEBSITE = "https://pavii.tech";
export const APP_REPOSITORY = "https://github.com/vjk7989/h0x-cli-v3";
export const APP_USER_AGENT = `${APP_MACHINE_NAME}/${getAppVersion()}`;

export function appUserAgent(component?: string): string {
  return component ? `${APP_USER_AGENT} (${component})` : APP_USER_AGENT;
}
