/**
 * Runtime configuration, resolved per request (the argus-studio#56 pattern).
 *
 * The server reads `process.env` through a *computed* key, so Next's build-time
 * inliner leaves it alone and one image deploys to any origin; the root layout
 * serializes the result into `window.__SIGHTLINE_ENV__` before hydration and the
 * client reads it back. Never read config at client module scope: the global is
 * only guaranteed to exist by the time components render.
 *
 *   ARGUS_SURVEY_URL       the argus-survey API as the *browser* sees it. Unset: http://localhost:8107.
 *                          Empty: same origin (a reverse proxy). A path prefix (/api/survey) also works.
 *   ARGUS_STUDIO_URL       link back to argus-studio, or unset for none.
 *   ARGUS_SURVEY_BASEMAP   XYZ raster tile template for the map's backdrop, "none" for a blank canvas.
 *                          Unset: OpenStreetMap's standard tiles (light use only, per their tile policy).
 *   ARGUS_SURVEY_BASEMAP_ATTRIBUTION   attribution for the basemap: text and <a href="http(s)://…"> links,
 *                          nothing else (sanitizeAttribution). Unset: OSM's for OSM's tiles
 *                          (whether defaulted or named explicitly, as compose does), none for others.
 */

import { staticDemo } from "@/lib/demo";

export interface RuntimeConfig {
  surveyUrl: string;
  studioUrl: string;
  basemapUrl: string;
  basemapAttribution: string;
}

export const RUNTIME_CONFIG_GLOBAL = "__SIGHTLINE_ENV__";

declare global {
  var __SIGHTLINE_ENV__: RuntimeConfig | undefined;
}

const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** First defined value among `names`. Computed lookup on purpose: a literal `process.env.X` would be inlined. */
function firstDefined(source: Record<string, string | undefined>, names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = source[name];
    if (value !== undefined) return value;
  }
  return undefined;
}

function isAbsoluteUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** Trim and drop trailing slashes; warn about a scheme-less value that would only fail in a browser. */
export function normalizeBase(value: string, name = "ARGUS_SURVEY_URL"): string {
  const base = value.trim().replace(/\/+$/, "");
  if (base !== "" && !base.startsWith("/") && !isAbsoluteUrl(base)) {
    console.warn(`[argus-sightline] ${name}="${base}" is not an absolute URL or "/"-prefixed path; requests will fail.`);
  }
  return base;
}

/** A link, not an API base: empty or invalid means no link. */
function resolveLink(value: string | undefined): string {
  const v = (value ?? "").trim();
  if (v === "") return "";
  return v.startsWith("/") || isAbsoluteUrl(v) ? v.replace(/\/+$/, "") : "";
}

/** A tag starts with `<` and a letter, `/`, `!` or `?`; a bare `<` is text, as in the HTML parser. */
const TAG = /<[a-z!/?][^>]*>/gi;
const hasTag = (html: string): boolean => html.search(TAG) !== -1;

const ENTITY = /&(?![a-z][a-z\d]*;|#\d+;|#x[\da-f]+;)/gi;

/** Tags dropped, then what's left escaped so it can only be text. Entities such as `&copy;` survive. */
const textOnly = (html: string): string =>
  html.replace(TAG, "").replace(ENTITY, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const ANCHOR = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
const HREF = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

/**
 * The basemap attribution reduced to text and `<a href="http(s)://…">` links. MapLibre's own sanitizer
 * (`DOM.sanitize`, which feeds the attribution control's innerHTML) skips an attribute after one it
 * removes in maplibre-gl ≤ 6.4.0 (GHSA-jrc7-96c5-q579), and 6.4.1's fix has no 5.x backport. The value
 * comes from the deployment, not from users, and the CSP blocks inline handlers anyway; this closes
 * the gap even with `ARGUS_SIGHTLINE_CSP=off`. Drop it once maplibre-gl is ≥ 6.4.1.
 */
export function sanitizeAttribution(html: string): string {
  let out = "";
  let last = 0;
  let dropped = false;
  for (const m of html.matchAll(ANCHOR)) {
    const before = html.slice(last, m.index);
    dropped ||= hasTag(before);
    out += textOnly(before);
    last = m.index + m[0].length;
    const h = HREF.exec(m[1]);
    const href = h ? (h[1] ?? h[2] ?? h[3]).trim() : "";
    const extra = m[1].replace(HREF, "").trim() !== "";
    const inner = textOnly(m[2]);
    if (isAbsoluteUrl(href)) out += `<a href="${href.replace(ENTITY, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}">${inner}</a>`;
    else out += inner;
    dropped ||= extra || !isAbsoluteUrl(href) || hasTag(m[2]);
  }
  const rest = html.slice(last);
  dropped ||= hasTag(rest);
  out += textOnly(rest);
  if (dropped) {
    console.warn("[argus-sightline] ARGUS_SURVEY_BASEMAP_ATTRIBUTION: kept only text and http(s) links; other markup was dropped.");
  }
  return out;
}

/** Pure, so the precedence rules are testable without a server. */
export function resolveRuntimeConfig(source: Record<string, string | undefined>): RuntimeConfig {
  const basemapRaw = firstDefined(source, ["ARGUS_SURVEY_BASEMAP"]);
  const basemap = basemapRaw === undefined ? OSM_TILES : basemapRaw.trim();
  // Compose names OSM's template explicitly; that is still OSM and still owes OSM's attribution.
  const custom = basemap !== OSM_TILES;
  // Empty counts as unset: compose passes an unset variable through as "".
  const attribution = sanitizeAttribution((firstDefined(source, ["ARGUS_SURVEY_BASEMAP_ATTRIBUTION"]) ?? "").trim());
  const none = basemap === "" || basemap.toLowerCase() === "none";
  return {
    surveyUrl: normalizeBase(firstDefined(source, ["ARGUS_SURVEY_URL"]) ?? "http://localhost:8107"),
    studioUrl: resolveLink(firstDefined(source, ["ARGUS_STUDIO_URL"])),
    basemapUrl: none ? "" : basemap,
    basemapAttribution: none ? "" : attribution || (custom ? "" : OSM_ATTRIBUTION),
  };
}

/**
 * The hosted demo's config, fixed at build time: the API is the tape on this origin (staticApi.ts reads it,
 * not this), no Studio link, and no basemap, so the page loads nothing from another origin (its CSP is
 * 'self' only) and puts no load on OpenStreetMap's tile servers.
 */
export const STATIC_CONFIG: RuntimeConfig = { surveyUrl: "", studioUrl: "", basemapUrl: "", basemapAttribution: "" };

let serverConfig: RuntimeConfig | undefined;
let warnedMissingGlobal = false;

export function runtimeConfig(): RuntimeConfig {
  if (staticDemo()) return STATIC_CONFIG;
  if (typeof window === "undefined") {
    serverConfig ??= resolveRuntimeConfig(process.env as Record<string, string | undefined>);
    return serverConfig;
  }
  const injected = globalThis.__SIGHTLINE_ENV__;
  if (injected) return injected;
  if (!warnedMissingGlobal) {
    warnedMissingGlobal = true;
    console.error(
      `[argus-sightline] window.${RUNTIME_CONFIG_GLOBAL} is missing (a CSP blocking inline scripts?); ` +
        "falling back to http://localhost:8107.",
    );
  }
  return resolveRuntimeConfig({});
}

/** The inline `<script>` body; `<` escaped so a value can never close the tag. */
export function runtimeConfigScript(config: RuntimeConfig): string {
  return `window.${RUNTIME_CONFIG_GLOBAL}=${JSON.stringify(config).replace(/</g, "\\u003c")};`;
}

/** The API base, read at call time (a function, never a module-scope const). */
export const surveyUrl = (): string => runtimeConfig().surveyUrl;
