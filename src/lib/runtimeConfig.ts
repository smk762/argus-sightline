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
 *   ARGUS_SURVEY_BASEMAP_ATTRIBUTION   attribution HTML for the basemap. Unset: OSM's for OSM's tiles
 *                          (whether defaulted or named explicitly, as compose does), none for others.
 */

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

/** Pure, so the precedence rules are testable without a server. */
export function resolveRuntimeConfig(source: Record<string, string | undefined>): RuntimeConfig {
  const basemapRaw = firstDefined(source, ["ARGUS_SURVEY_BASEMAP"]);
  const basemap = basemapRaw === undefined ? OSM_TILES : basemapRaw.trim();
  // Compose names OSM's template explicitly; that is still OSM and still owes OSM's attribution.
  const custom = basemap !== OSM_TILES;
  // Empty counts as unset: compose passes an unset variable through as "".
  const attribution = (firstDefined(source, ["ARGUS_SURVEY_BASEMAP_ATTRIBUTION"]) ?? "").trim();
  const none = basemap === "" || basemap.toLowerCase() === "none";
  return {
    surveyUrl: normalizeBase(firstDefined(source, ["ARGUS_SURVEY_URL"]) ?? "http://localhost:8107"),
    studioUrl: resolveLink(firstDefined(source, ["ARGUS_STUDIO_URL"])),
    basemapUrl: none ? "" : basemap,
    basemapAttribution: none ? "" : attribution || (custom ? "" : OSM_ATTRIBUTION),
  };
}

let serverConfig: RuntimeConfig | undefined;
let warnedMissingGlobal = false;

export function runtimeConfig(): RuntimeConfig {
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
