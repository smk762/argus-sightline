/**
 * The guided demo. `argus-survey synth DIR --kit` (`make demo-data` here) writes
 * a synthetic site with analytically known answers; when its files are under the
 * server's data root, the UI prefills every step with them and shows the known
 * answer next to the measured one.
 *
 * The expected values are the kit's analytic truths (a seeded, fixed scene:
 * cone r = 8 m, h = 4 m, grown 1 m at the apex in epoch 2; pad 18 × 20 m benched
 * 0.25 m below the ground at its centre). argus-survey writes them to
 * `kit-truth.json` too, but the API serves names under the data root, not
 * their contents, so they are restated here.
 */

import type { Inputs } from "@/lib/surveyApi";

export interface DemoKit {
  dir: string;
  epoch1: string;
  epoch2: string | null;
  checks: string | null;
  stockpile: string | null;
  pad: string | null;
  design: string | null;
}

export const KIT_TRUTH = {
  stockpileVolume: (Math.PI * 8 ** 2 * 4) / 3, // 268.083 m³
  stockpileVolumeE2: (Math.PI * 8 ** 2 * 5) / 3, // 335.103 m³, the same cone grown 1 m at the apex
  changeGain: (Math.PI * 8 ** 2 * 1) / 3, // 67.021 m³, before any level of detection
  padNetCut: 0.25 * 18 * 20, // 90 m³ (cut − fill)
  crs: "EPSG:7850+5711",
} as const;

/**
 * How far "measured" may sit from the truth, in percent, before the demo flags it.
 * The README's recorded numbers are held to the same limits (src/lib/sync.test.ts).
 */
export const TRUTH_TOLERANCE = {
  "stockpile-e1": 3,
  "stockpile-e2": 3,
  "pad-net-cut": 3,
  "change-gain": 6,
} as const;

export const KIT_JOB_1 = "kit-e1";
export const KIT_JOB_2 = "kit-e2";

/** Find a kit among the server's inputs: a directory holding `site-e1.laz`. */
export function findKit(inputs: Inputs | null): DemoKit | null {
  if (!inputs) return null;
  const e1 = inputs.points.find((p) => p === "site-e1.laz" || p.endsWith("/site-e1.laz"));
  if (!e1) return null;
  const dir = e1.slice(0, e1.length - "site-e1.laz".length);
  const pick = (list: string[], name: string): string | null => list.find((p) => p === dir + name) ?? null;
  return {
    dir,
    epoch1: e1,
    epoch2: pick(inputs.points, "site-e2.laz"),
    checks: pick(inputs.tables, "checks.csv"),
    stockpile: pick(inputs.vectors, "stockpile.geojson"),
    pad: pick(inputs.vectors, "pad.geojson"),
    design: pick(inputs.rasters, "design.tif"),
  };
}

/** Relative error as a percentage, for "measured vs known". */
export const relError = (measured: number, truth: number): number => ((measured - truth) / truth) * 100;
