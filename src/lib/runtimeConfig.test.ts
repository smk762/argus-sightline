import { describe, expect, it } from "vitest";
import { resolveRuntimeConfig, runtimeConfigScript } from "@/lib/runtimeConfig";

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
