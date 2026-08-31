import * as fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { huggingFaceToken } from "./huggingface-api.js";

export type DownloadProgressFn = (
  percent: number,
  transferred: number,
  total: number,
) => void;

function createAbortError(): Error {
  const err = new Error("Download aborted");
  err.name = "AbortError";
  return err;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Download a file from `url` to `destPath` with optional progress tracking.
 * Writes to a `.tmp` file first, then renames atomically on success.
 */
export async function downloadFile(
  url: string,
  destPath: string,
  opts?: {
    onProgress?: DownloadProgressFn;
    userAgent?: string;
    signal?: AbortSignal;
  },
): Promise<void> {
  throwIfAborted(opts?.signal);
  const res = await fetchDownload(url, opts);
  throwIfAborted(opts?.signal);
  if (!res.ok || !res.body) {
    throw new Error(`Download failed: HTTP ${res.status} ${res.statusText}`);
  }

  const totalRaw = res.headers.get("content-length");
  const total = totalRaw ? parseInt(totalRaw, 10) : 0;
  let transferred = 0;
  let lastEmitAt = 0;
  let lastEmittedBytes = -1;

  /**
   * Progress used to be emitted only when the whole-number percentage
   * changed, which left the byte counter frozen between those moments: one
   * percent of a 4 GB GGUF is ~41 MB, so at realistic speeds the UI sat
   * still for seconds at a time and the download looked stalled. Worse, a
   * response without `content-length` pins `percent` at 0 forever, so after
   * the first chunk the counter never moved again.
   *
   * Emit on a time base instead. The percentage still only changes when it
   * changes; the bytes advance visibly, which is the part that tells the
   * user the transfer is alive.
   */
  const PROGRESS_INTERVAL_MS = 200;

  const emitProgress = (now: number): void => {
    if (transferred === lastEmittedBytes) return;
    lastEmitAt = now;
    lastEmittedBytes = transferred;
    const percent = total > 0 ? Math.round((transferred / total) * 100) : 0;
    opts?.onProgress?.(percent, transferred, total);
  };

  const reader = res.body.getReader();
  const trackingStream = new ReadableStream({
    async pull(controller) {
      throwIfAborted(opts?.signal);
      const { done, value } = await reader.read();
      throwIfAborted(opts?.signal);
      if (done) {
        // The last partial interval still owes the user its final numbers,
        // including the terminal 100%.
        emitProgress(Date.now());
        controller.close();
        return;
      }
      transferred += value.byteLength;
      const now = Date.now();
      if (now - lastEmitAt >= PROGRESS_INTERVAL_MS) {
        emitProgress(now);
      }
      controller.enqueue(value);
    },
  });

  const nodeReadable = Readable.fromWeb(
    trackingStream as import("node:stream/web").ReadableStream,
  );
  const tmpPath = `${destPath}.tmp`;
  try {
    const writeStream = fs.createWriteStream(tmpPath);
    await pipeline(nodeReadable, writeStream);
    throwIfAborted(opts?.signal);
    fs.renameSync(tmpPath, destPath);
  } finally {
    try {
      fs.rmSync(tmpPath, { force: true });
    } catch {
      /* ignore */
    }
  }
}

async function fetchDownload(
  url: string,
  opts?: {
    userAgent?: string;
    signal?: AbortSignal;
  },
): Promise<Response> {
  let currentUrl = parseDownloadUrl(url);
  for (let redirects = 0; ; redirects++) {
    const res = await fetch(currentUrl, {
      headers: buildDownloadHeaders(currentUrl, opts?.userAgent),
      redirect: "manual",
      signal: opts?.signal,
    });
    if (!REDIRECT_STATUSES.has(res.status)) return res;

    const location = res.headers.get("location");
    if (location === null || location.length === 0) return res;
    if (redirects >= MAX_REDIRECTS) {
      throw new Error(`Download failed: too many redirects (> ${MAX_REDIRECTS})`);
    }
    currentUrl = new URL(location, currentUrl);
    if (currentUrl.protocol !== "https:") {
      throw new Error("Download failed: redirect target must use HTTPS");
    }
    throwIfAborted(opts?.signal);
  }
}

function buildDownloadHeaders(
  url: URL,
  userAgent: string | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": userAgent ?? "atomic-agent/local-llm",
  };
  const token = tokenForDownloadUrl(url);
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function tokenForDownloadUrl(url: URL): string | null {
  if (url.protocol !== "https:") return null;
  if (isTrustedDownloadHost(url.hostname, ["github.com", "githubusercontent.com"])) {
    const token = (process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "").trim();
    return token.length > 0 ? token : null;
  }
  if (isTrustedDownloadHost(url.hostname, ["huggingface.co"])) {
    return huggingFaceToken();
  }
  return null;
}

function isTrustedDownloadHost(hostname: string, roots: readonly string[]): boolean {
  const lower = hostname.toLowerCase();
  return roots.some((root) => lower === root || lower.endsWith(`.${root}`));
}

function parseDownloadUrl(url: string): URL {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Download failed: unsupported URL protocol ${parsed.protocol}`);
  }
  return parsed;
}
