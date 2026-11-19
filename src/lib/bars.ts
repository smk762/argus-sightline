/** Geometry for the small proportional bars in the panels (density spread, timings). */

/**
 * `part` as a percentage of `whole`, clamped to 0–100, or `null` when there is nothing to scale by: a `whole`
 * that is zero, negative or not finite (a degenerate cloud's p95 density of 0, timings that all read 0 s), or a
 * missing `part`. A CSS length built from `0 / 0` is `NaN%`, which the browser drops, so callers must not.
 */
export function share(part: number | null | undefined, whole: number | null | undefined): number | null {
  if (part === null || part === undefined || !Number.isFinite(part)) return null;
  if (whole === null || whole === undefined || !Number.isFinite(whole) || whole <= 0) return null;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}
