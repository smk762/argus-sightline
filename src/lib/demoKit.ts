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

/** The analytic answer a measured number is checked against, with the tolerance (percent) it is held to. */
export interface Truth {
  truth: number;
  tolerance: number;
}

/**
 * The kit's polygons name their one feature (`stockpile.geojson` → "stockpile", `pad.geojson` → "pad"), and
 * argus-survey names a volume zone after it. A polygon the user drew or picked is something else, and the
 * analytic answer does not apply to it.
 */
export const KIT_STOCKPILE_ZONE = "stockpile";

/**
 * A change report's `area` is the polygon file's name (argus-survey change.py: `polygon.name`), not a feature
 * name: "stockpile.geojson" for the kit's stockpile polygon.
 */
export const KIT_STOCKPILE_FILE = "stockpile.geojson";

/**
 * The truth for one zone of a stockpile volume: only the kit's stockpile polygon, on a kit job, with the epoch's
 * own cone and tolerance (epoch 2 grew 1 m at the apex). `null` everywhere else.
 */
export function stockpileTruth(kit: DemoKit | null, jobId: string, zoneName: string): Truth | null {
  if (!kit || !jobId.startsWith("kit-") || zoneName !== KIT_STOCKPILE_ZONE) return null;
  return jobId === KIT_JOB_2
    ? { truth: KIT_TRUTH.stockpileVolumeE2, tolerance: TRUTH_TOLERANCE["stockpile-e2"] }
    : { truth: KIT_TRUTH.stockpileVolume, tolerance: TRUTH_TOLERANCE["stockpile-e1"] };
}

/**
 * The truth for a change report: epoch 2 against epoch 1, inside the kit's stockpile polygon, with no level of
 * detection. Any other pairing, polygon or LoD measures something the analytic gain does not describe.
 */
export function changeTruth(
  kit: DemoKit | null,
  jobId: string,
  change: { against_job: string; area?: string | null; lod_m: number },
): Truth | null {
  if (!kit || jobId !== KIT_JOB_2 || change.against_job !== KIT_JOB_1) return null;
  if (change.lod_m !== 0 || change.area !== KIT_STOCKPILE_FILE) return null;
  return { truth: KIT_TRUTH.changeGain, tolerance: TRUTH_TOLERANCE["change-gain"] };
}
