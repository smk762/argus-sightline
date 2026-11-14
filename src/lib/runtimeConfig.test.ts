import { describe, expect, it, vi } from "vitest";
import { resolveRuntimeConfig, runtimeConfigScript, sanitizeAttribution } from "@/lib/runtimeConfig";

describe("resolveRuntimeConfig", () => {
  it("defaults to the local API and OSM tiles", () => {
    const c = resolveRuntimeConfig({});
    expect(c.surveyUrl).toBe("http://localhost:8107");
    expect(c.basemapUrl).toContain("openstreetmap");
    expect(c.basemapAttribution).toContain("OpenStreetMap");
  });

  it("attributes OSM tiles named explicitly, and nothing else unless told", () => {
    const osm = resolveRuntimeConfig({ ARGUS_SURVEY_BASEMAP: "https://tile.openstreetmap.org/{z}/{x}/{y}.png" });
    expect(osm.basemapAttribution).toContain("OpenStreetMap");
    const osmEmpty = resolveRuntimeConfig({ ARGUS_SURVEY_BASEMAP: osm.basemapUrl, ARGUS_SURVEY_BASEMAP_ATTRIBUTION: "" });
    expect(osmEmpty.basemapAttribution).toContain("OpenStreetMap");
    const custom = { ARGUS_SURVEY_BASEMAP: "https://tiles.example/{z}/{x}/{y}.png" };
    expect(resolveRuntimeConfig(custom).basemapAttribution).toBe("");
    expect(
      resolveRuntimeConfig({ ...custom, ARGUS_SURVEY_BASEMAP_ATTRIBUTION: "© Example" }).basemapAttribution,
    ).toBe("© Example");
  });

  it("treats an empty API URL as same origin and trims slashes", () => {
    expect(resolveRuntimeConfig({ ARGUS_SURVEY_URL: "" }).surveyUrl).toBe("");
    expect(resolveRuntimeConfig({ ARGUS_SURVEY_URL: "/api/survey/" }).surveyUrl).toBe("/api/survey");
  });

  it("turns the basemap off with none and drops bad links", () => {
    const c = resolveRuntimeConfig({ ARGUS_SURVEY_BASEMAP: "none", ARGUS_STUDIO_URL: "javascript:alert(1)" });
    expect(c.basemapUrl).toBe("");
    expect(c.studioUrl).toBe("");
  });

  it("escapes < in the injected script", () => {
    const script = runtimeConfigScript({ ...resolveRuntimeConfig({}), studioUrl: "</script>" });
    expect(script).not.toContain("</script>");
  });
});

describe("sanitizeAttribution (GHSA-jrc7-96c5-q579 workaround)", () => {
  const quiet = () => vi.spyOn(console, "warn").mockImplementation(() => {});

  it("leaves OSM's default and plain text alone, without a warning", () => {
    const warn = quiet();
    const osm = resolveRuntimeConfig({}).basemapAttribution;
    expect(osm).toBe('© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors');
    expect(sanitizeAttribution("&copy; Example &amp; Co")).toBe("&copy; Example &amp; Co");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("drops the advisory's payload: the tag and every attribute", () => {
    const warn = quiet();
    const out = sanitizeAttribution('<details open onload="1" ontoggle="alert(1)">x</details> © Tiles');
    expect(out).toBe("x © Tiles");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("keeps only the href of a link, and only an http(s) one", () => {
    const warn = quiet();
    expect(sanitizeAttribution(`<a href='https://x.example/?a=1&b=2' onclick="alert(1)" style="x">X</a>`)).toBe(
      '<a href="https://x.example/?a=1&amp;b=2">X</a>',
    );
    expect(sanitizeAttribution('<a href="javascript:alert(1)">bad</a>')).toBe("bad");
    expect(sanitizeAttribution('<a href="https://x.example"><img src=x onerror="alert(1)">X</a>')).toBe(
      '<a href="https://x.example">X</a>',
    );
    expect(sanitizeAttribution('<a href="https://x.example" title="t">X</a>')).toBe('<a href="https://x.example">X</a>');
    warn.mockRestore();
  });

  it("escapes what survives as text, so a stray angle bracket or quote can't open a tag", () => {
    const warn = quiet();
    expect(sanitizeAttribution('a < b "c" <script>alert(1)</script>')).toBe("a &lt; b &quot;c&quot; alert(1)");
    expect(sanitizeAttribution('<a href="https://x.example/">"><svg onload=alert(1)>X</a>')).toBe(
      '<a href="https://x.example/">&quot;&gt;X</a>',
    );
    warn.mockRestore();
  });

  it("is applied to ARGUS_SURVEY_BASEMAP_ATTRIBUTION", () => {
    const warn = quiet();
    const cfg = resolveRuntimeConfig({
      ARGUS_SURVEY_BASEMAP: "https://tiles.example/{z}/{x}/{y}.png",
      ARGUS_SURVEY_BASEMAP_ATTRIBUTION: '<details open ontoggle="alert(1)">© Example</details>',
    });
    expect(cfg.basemapAttribution).toBe("© Example");
    warn.mockRestore();
  });
});
