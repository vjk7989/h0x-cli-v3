const REDACTED = "<redacted>";

const SECRET_KEY_PARTS = [
  "authorization",
  "cookie",
  "password",
  "passwd",
  "secret",
  "token",
  "apikey",
  "api_key",
  "x-api-key",
  "x-subscription-token",
  "access_key",
  "private_key",
];

const SECRET_QUERY_KEYS = new Set([
  "access_token",
  "api_key",
  "apikey",
  "auth",
  "authorization",
  "code",
  "key",
  "password",
  "secret",
  "signature",
  "sig",
  "token",
]);

export function redactSecretText(value: string): string {
  return redactUrlSecrets(value)
    .replace(/\b(authorization|proxy-authorization)\s*:\s*(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, `$1: $2 ${REDACTED}`)
    .replace(/\b(authorization|proxy-authorization)\s*:\s*(?!(?:bearer|basic)\b)[^\s\r\n]+/gi, `$1: ${REDACTED}`)
    .replace(/\b(cookie|set-cookie)\s*:\s*[^\r\n]+/gi, `$1: ${REDACTED}`)
    .replace(/\b(x-api-key|api-key|x-subscription-token)\s*:\s*[^\s\r\n]+/gi, `$1: ${REDACTED}`)
    .replace(/\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, `$1 ${REDACTED}`)
    .replace(
      /\b([A-Za-z0-9_.-]*(?:api[_-]?key|token|secret|password|passwd)[A-Za-z0-9_.-]*)\s*[:=]\s*("[^"]+"|'[^']+'|[^\s,&}]+)/gi,
      (_match, key: string) => `${key}=${REDACTED}`,
    )
    .replace(
      /(["'])([^"']*(?:api[_-]?key|token|secret|password|passwd)[^"']*)\1\s*:\s*(["'])(.*?)\3/gi,
      (_match, quote: string, key: string) => `${quote}${key}${quote}:${quote}${REDACTED}${quote}`,
    );
}

export function redactSecretsDeep<T>(value: T): T {
  return redactValue(value, new WeakSet()) as T;
}

export function redactDiagnosticPayload<T>(value: T): T {
  return redactValue(value, new WeakSet(), { redactBody: true }) as T;
}

function redactValue(
  value: unknown,
  seen: WeakSet<object>,
  options: { redactBody?: boolean } = {},
): unknown {
  if (typeof value === "string") return redactSecretText(value);
  if (typeof value !== "object" || value === null) return value;
  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen, options));
  }

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] =
      isSecretKey(key) || (options.redactBody === true && key.toLowerCase() === "body")
        ? REDACTED
        : redactValue(child, seen, options);
  }
  return out;
}

function isSecretKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9_:-]/g, "");
  const compact = normalized.replace(/[-_:]/g, "");
  return SECRET_KEY_PARTS.some((part) => {
    const partCompact = part.replace(/[-_:]/g, "");
    return normalized === part || compact.includes(partCompact);
  });
}

function redactUrlSecrets(value: string): string {
  return value.replace(/https?:\/\/[^\s"'<>]+/gi, (raw) => {
    try {
      const url = new URL(raw);
      if (url.username.length > 0 || url.password.length > 0) {
        url.username = REDACTED;
        url.password = "";
      }
      for (const key of [...url.searchParams.keys()]) {
        if (SECRET_QUERY_KEYS.has(key.toLowerCase())) {
          url.searchParams.set(key, REDACTED);
        }
      }
      return url.toString();
    } catch {
      return raw;
    }
  });
}
