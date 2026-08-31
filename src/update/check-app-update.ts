export const APP_UPDATE_UNAVAILABLE =
  "Updates are unavailable in this h0x-cli development build; release packaging is not ready.";

export interface AppUpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestTag: string;
  latestVersion: string;
}

export class AppUpdateCheckError extends Error {
  constructor(message: string, public readonly status: number | null) {
    super(message);
    this.name = "AppUpdateCheckError";
  }
}

/** Compatibility hook; disabled release checks keep no cache. */
export function resetAppReleaseCache(): void {}

/** Fork releases are not configured. Never contact the upstream release API. */
export async function checkForAppUpdate(_opts?: {
  repo?: string;
  currentVersion?: string;
  fetchImpl?: typeof fetch;
  force?: boolean;
}): Promise<AppUpdateCheckResult> {
  throw new AppUpdateCheckError(APP_UPDATE_UNAVAILABLE, null);
}
