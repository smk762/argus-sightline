import { describe, expect, it } from "vitest";
import { resolveZone } from "@/lib/zone";

// Audit pack-argus-sightline-e4081141fb: cut/fill's area is optional, but only "Whole design" may send no polygon.
describe("resolveZone", () => {
  const square: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
  ];

  it("is missing when 'Draw on map' has nothing drawn, or 'Polygon file' has no file", () => {
    expect(resolveZone("draw", "", null, "drawn polygon")).toEqual({ zone: null, missing: true });
    expect(resolveZone("file", "", null, "drawn polygon")).toEqual({ zone: null, missing: true });
  });

  it("sends no polygon only for the explicit whole-design choice", () => {
    expect(resolveZone("none", "pad.geojson", square, "z")).toEqual({ zone: null, missing: false });
  });

  it("carries the chosen file, or the drawn ring closed", () => {
    expect(resolveZone("file", "pad.geojson", square, "z")).toEqual({ zone: { polygon: "pad.geojson" }, missing: false });
    const drawn = resolveZone("draw", "pad.geojson", square, "");
    expect(drawn.missing).toBe(false);
    expect(drawn.zone).toEqual({
      polygon_geojson: { type: "Polygon", coordinates: [[...square, [0, 0]]] },
      name: "drawn polygon",
    });
  });
});
