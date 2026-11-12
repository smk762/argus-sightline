/**
 * The Content-Security-Policy, built per request by src/proxy.ts.
 *
 * It is a strict, nonce-based script policy. Next.js reads the nonce back out of
 * the request's CSP header and stamps it on its own scripts. The layout stamps
 * it on our two inline scripts, the theme boot and the runtime config.
 * 'strict-dynamic' then trusts whatever those scripts load (route chunks,
 * MapLibre, three, copc). There is no origin allowlist to keep in step with
 * the API URL.
 *
 *   'wasm-unsafe-eval'   laz-perf compiles /laz-perf.wasm (the point view)
 *   worker-src blob:     MapLibre starts its workers from a blob: URL
 *   'unsafe-eval'        dev only: React rebuilds server error stacks with eval
 *
 * Styles, images and connections are left open on purpose. The API and basemap
 * origins are runtime config, and MapLibre and React set inline styles.
 *
 * ARGUS_SIGHTLINE_CSP: "enforce" (default), "report-only" or "off".
 */

export type CspMode = "enforce" | "report-only" | "off";

export function cspMode(value: string | undefined): CspMode {
  const v = (value ?? "").trim().toLowerCase();
  return v === "off" || v === "report-only" ? v : "enforce";
}

export function buildCsp(nonce: string, { dev = false }: { dev?: boolean } = {}): string {
  const script = [`'nonce-${nonce}'`, "'strict-dynamic'", "'wasm-unsafe-eval'", "'report-sample'", ...(dev ? ["'unsafe-eval'"] : [])];
  return [
    `script-src ${script.join(" ")}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** 128 random bits, base64: unguessable, and fresh for every response. */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

export const CSP_HEADER: Record<Exclude<CspMode, "off">, string> = {
  enforce: "Content-Security-Policy",
  "report-only": "Content-Security-Policy-Report-Only",
};
