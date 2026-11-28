/**
 * Runtime configuration, resolved per request (the argus-studio#56 pattern).
 *
 * The server reads `process.env` through a *computed* key, so Next's build-time
 * inliner leaves it alone and one image deploys to any origin; the root layout
 * serializes the result into `window.__SIGHTLINE_ENV__` before hydration and the
 * client reads it back. Never read config at client module scope: the global is
 * only guaranteed to exist by the time components render.
 *
 *   ARGUS_SURVEY_BROWSER_URL    the argus-survey API as the *browser* sees it. Unset: http://localhost:8107.
 *                          Empty: same origin (a reverse proxy). A path prefix (/api/survey) also works.
 *                          Not ARGUS_SURVEY_URL: that is the suite-wide name for the address *servers* use
 *                          (argus-cortex `peers`, e.g. http://survey:8107), which a browser can't reach.
 *                          It is read here only as a deprecated alias, and only when it is a "/" path.
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

/** The API base the browser uses. */
const SURVEY_BROWSER_URL = "ARGUS_SURVEY_BROWSER_URL";
/** Its name up to 0.2.0, now the suite-wide server-to-server URL of the `survey` peer (argus-cortex#209). */
const SURVEY_PEER_URL = "ARGUS_SURVEY_URL";

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

/**
 * Trim and drop trailing slashes; warn about a scheme-less value that would only fail in a browser. The warning
 * names the variable, never the value: a malformed URL (`user:token@host:8107`) can still carry credentials.
 */
export function normalizeBase(value: string, name = SURVEY_BROWSER_URL): string {
  const base = value.trim().replace(/\/+$/, "");
  if (base !== "" && !base.startsWith("/") && !isAbsoluteUrl(base)) {
    console.warn(`[argus-sightline] ${name} is not an absolute URL or "/"-prefixed path; requests will fail.`);
  }
  return base;
}

/**
 * The browser's API base: ARGUS_SURVEY_BROWSER_URL. The old name is honoured only when its value is a path
 * (starts with one "/"), which can't be a server-to-server URL; anything else under it belongs to the
 * suite's servers and is left alone. Warnings name the variable, never the value (a URL can carry credentials).
 */
function resolveSurveyUrl(source: Record<string, string | undefined>): string {
  const current = firstDefined(source, [SURVEY_BROWSER_URL]);
  if (current !== undefined) return normalizeBase(current);
  const legacy = (firstDefined(source, [SURVEY_PEER_URL]) ?? "").trim();
  if (legacy.startsWith("/") && !legacy.startsWith("//")) {
    console.warn(`[argus-sightline] ${SURVEY_PEER_URL} as the browser's path is deprecated; rename it to ${SURVEY_BROWSER_URL}.`);
    return normalizeBase(legacy, SURVEY_PEER_URL);
  }
  if (legacy !== "") {
    console.warn(`[argus-sightline] ${SURVEY_PEER_URL} is the server-side URL and is not given to the browser; set ${SURVEY_BROWSER_URL}.`);
  }
  return "http://localhost:8107";
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
// An attribute named exactly `href`: after whitespace, so `data-href=` or `xhref=` is not it.
const HREF = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

/**
 * The basemap attribution reduced to text and `<a href="http(s)://…">` links. MapLibre's own sanitizer
 * (`DOM.sanitize`, which feeds the attribution control's innerHTML) skips an attribute after one it
 * removed in maplibre-gl ≤ 6.4.0 (GHSA-jrc7-96c5-q579, fixed in 6.4.1, which this UI is past). Kept as
 * defence in depth: the value is HTML from the deployment that reaches innerHTML, and this holds even
 * with `ARGUS_SIGHTLINE_CSP=off` or a future regression in MapLibre's sanitizer.
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
    surveyUrl: resolveSurveyUrl(source),
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
