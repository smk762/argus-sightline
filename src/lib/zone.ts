import { closeRing, type LonLat } from "@/lib/geo";

/** Where a measurement's polygon comes from: a vector file under the data root, one drawn on the map, or none. */
export type ZoneMode = "file" | "draw" | "none";

export type Zone = { polygon: string } | { polygon_geojson: GeoJSON.Polygon; name: string } | null;

/**
 * The polygon a request carries for the chosen area, and whether the user still owes one. Only "none" (the
 * explicit "Whole design" choice) may send no polygon: a file mode with no file, or a draw mode with nothing
 * drawn, is missing, so a run never measures the whole surface while the form shows a zone.
 */
export function resolveZone(
  mode: ZoneMode,
  file: string,
  drawn: readonly LonLat[] | null,
  name: string,
): { zone: Zone; missing: boolean } {
  const zone: Zone =
    mode === "file" && file
      ? { polygon: file }
      : mode === "draw" && drawn
        ? { polygon_geojson: { type: "Polygon", coordinates: [closeRing(drawn)] }, name: name || "drawn polygon" }
        : null;
  return { zone, missing: mode !== "none" && zone === null };
}
