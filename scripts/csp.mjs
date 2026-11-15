// Post-build: give every exported page of the hosted demo a strict, hash-based Content-Security-Policy.
//
// `next build` (output: "export") emits Next's bootstrap as inline <script>s and there is no server to
// mint nonces, so each page gets a <meta http-equiv> CSP listing the sha256 of exactly the inline scripts
// it shipped with. Hashing at build time is safe because the HTML contains no user content: the pages are
// prerendered with no job in them, and the tape is fetched at runtime as JSON. The tape must be
// same-origin (NEXT_PUBLIC_SIGHTLINE_TAPE_URL is a path), so the policy names no other origin.
// Adapted from argus-cull's scripts/csp.mjs (itself from argus-lightbox's).
//
// Where it differs from Cull's:
//   - 'wasm-unsafe-eval': laz-perf compiles /laz-perf.wasm (the 3D view).
//   - worker-src blob: and img-src blob: data:: MapLibre starts its workers from blob: URLs.
//   - style-src 'unsafe-inline': React and MapLibre set inline styles (the live build leaves styles open too).
//   - No Trusted Types. MapLibre 5 writes its scale and attribution controls through innerHTML and starts
//     workers from blob: URLs, and the survey docs pages render through dangerouslySetInnerHTML on a
//     client-side navigation, so `require-trusted-types-for 'script'` would need a policy that passes HTML
//     through, which protects nothing. Script execution stays locked to 'self' plus the hashes.
//   - The recorded report under the tape is not one of this site's pages: it keeps its inline styles and
//     gets a sandboxed policy of its own in _headers.
// Directives a <meta> CSP can't carry (frame-ancestors) go in out/_headers, which Cloudflare Pages reads.
//
// It also copies argus-survey's docs images into the export: the live build serves them from a route
// (src/app/docs/survey/img/[name]/route.live.ts), which a static export can't have.
//
//   node scripts/csp.mjs [outDir]   (run by `npm run build:pages`)
import { createHash } from "node:crypto";
import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

/** @param {string} html @returns {string[]} CSP hash sources for each non-empty inline script. */
export function inlineScriptHashes(html) {
  const hashes = new Set();
  for (const [, body] of html.matchAll(INLINE_SCRIPT)) {
    if (body) hashes.add(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
  }
  return [...hashes];
}

/** @param {string | undefined} url @returns {string} The tape URL, which must be a same-origin path. */
export function sameOriginTape(url) {
  if (url && /^[a-z][a-z0-9+.-]*:|^\/\//i.test(url)) throw new Error(`csp: NEXT_PUBLIC_SIGHTLINE_TAPE_URL must be a path on this site, not ${url}`);
  return url || "/data-tape";
}

/** @param {string[]} hashes */
export function policy(hashes) {
  return [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(" ")}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}

/**
 * @param {string} html
 * @param {string} themeScript the family theme script's URL, added blocking right after the policy, so the
 *   saved theme is on <html> before the first paint. The static build adds it here rather than in the React
 *   tree, which would recreate it on a client render.
 * @returns {string} html with the CSP <meta> ahead of any script: right after <meta charset> (which has to
 *   stay within the first 1024 bytes), else first in <head>.
 */
export function withCsp(html, themeScript = "") {
  if (html.includes('http-equiv="Content-Security-Policy"')) throw new Error("page already has a CSP <meta>");
  const anchor = /<meta charset=[^>]*>/i.exec(html) ?? /<head[^>]*>/i.exec(html);
  if (!anchor) throw new Error("no <head> to put the CSP in");
  const end = anchor.index + anchor[0].length;
  const theme = themeScript ? `<script src="${themeScript}"></script>` : "";
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy(inlineScriptHashes(html))}"/>`;
  return html.slice(0, end) + meta + theme + html.slice(end);
}

// Response headers for hosts that read a _headers file. frame-ancestors only works as a header.
// Next's /_next/static/ files are content-hashed, so they can be cached for good. The tape's files are data;
// the one HTML file in it (the recorded report) runs no script and loads nothing.
/** @param {string} tape the tape's path @returns {string} the _headers file */
export const headers = (tape = "/data-tape") => `/*
  Content-Security-Policy: frame-ancestors 'none'
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), geolocation=(), microphone=()
  Cross-Origin-Opener-Policy: same-origin-allow-popups
  Strict-Transport-Security: max-age=31536000

/_next/static/*
  Cache-Control: public, max-age=31536000, immutable

${tape}/*
  Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; sandbox
`;

/** The site's own pages: every .html in the export except the recorded files under the tape. */
function htmlFiles(dir, tapeDir) {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith(".html"))
    .map((e) => join(e.parentPath, e.name))
    .filter((f) => !relative(dir, f).startsWith(tapeDir + sep));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] ?? "out";
  if (process.env.NEXT_PUBLIC_SIGHTLINE_STATIC !== "1" && process.env.SIGHTLINE_STATIC !== "1") {
    console.log("csp: skipped (not the static demo build)");
  } else {
    const tape = sameOriginTape(process.env.NEXT_PUBLIC_SIGHTLINE_TAPE_URL).replace(/\/+$/, "");
    const img = join("docs", "survey", "docs", "img");
    if (existsSync(img)) cpSync(img, join(out, "docs", "survey", "img"), { recursive: true });
    const files = htmlFiles(out, tape.replace(/^\/+/, ""));
    for (const file of files) writeFileSync(file, withCsp(readFileSync(file, "utf8"), "/dh-theme.js"));
    writeFileSync(join(out, "_headers"), headers(tape));
    console.log(`csp: ${files.length} page(s)`);
  }
}
