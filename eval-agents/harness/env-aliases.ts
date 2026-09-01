export function readEvalEnv(
  h0xName: string,
  legacyName: string,
): string | undefined {
  const h0x = process.env[h0xName]?.trim();
  if (h0x) return h0x;
  const legacy = process.env[legacyName]?.trim();
  return legacy || undefined;
}

