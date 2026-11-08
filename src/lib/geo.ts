/**
 * Just enough geodesy for live feedback while drawing (lengths and areas shown
 * as "≈"). Never used for a deliverable: volumes and profiles are computed by
 * argus-survey in the job's projected CRS.
 */

export type LonLat = [number, number];

const R = 6_371_008.8; // mean Earth radius, metres
const rad = (d: number): number => (d * Math.PI) / 180;

/** Great-circle length of a polyline in metres. */
export function lineLength(points: readonly LonLat[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const [lon1, lat1] = points[i - 1];
    const [lon2, lat2] = points[i];
    const dlat = rad(lat2 - lat1);
    const dlon = rad(lon2 - lon1);
    const a = Math.sin(dlat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dlon / 2) ** 2;
    total += 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  return total;
}

/** Area of a simple polygon ring (open or closed) in m², on a local equirectangular projection. */
export function ringArea(ring: readonly LonLat[]): number {
  if (ring.length < 3) return 0;
  const lat0 = rad(ring.reduce((s, p) => s + p[1], 0) / ring.length);
  const xy = ring.map(([lon, lat]) => [R * rad(lon) * Math.cos(lat0), R * rad(lat)] as const);
  let twice = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    twice += x1 * y2 - x2 * y1;
  }
  return Math.abs(twice) / 2;
}

/** Close a ring for GeoJSON (first position repeated last). */
export function closeRing(ring: readonly LonLat[]): LonLat[] {
  if (ring.length === 0) return [];
  const [f, l] = [ring[0], ring[ring.length - 1]];
  return f[0] === l[0] && f[1] === l[1] ? [...ring] : [...ring, f];
}

/** [[west, south], [east, north]] of a set of positions. */
export function bbox(points: readonly LonLat[]): [LonLat, LonLat] | null {
  if (points.length === 0) return null;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return [
    [Math.min(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.max(...ys)],
  ];
}
