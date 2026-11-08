/**
 * The survey workflow as the UI presents it: the steps, their groups, and
 * whether each can run on a given job. Pure (derived from `job.json`), so the
 * rail and the panels agree with each other and the rules are unit-tested.
 *
 * The prerequisites mirror the server's own refusals (`Job.require_crs`,
 * `product_path(..., needed_by=)`); the server stays the authority, this only
 * stops the UI offering a step that would certainly be refused.
 */

import type { JobSidecar } from "@/lib/generated/survey";
import type { StepId } from "@/lib/surveyApi";

export type StepGroup = "Capture" | "Model" | "Measure" | "Deliver";

export interface StepDef {
  id: Exclude<StepId, "run">;
  label: string;
  group: StepGroup;
  blurb: string;
}

export const STEPS: readonly StepDef[] = [
  { id: "ingest", label: "Ingest", group: "Capture", blurb: "Pin inputs, resolve datums, reproject, build the COPC" },
  { id: "qa", label: "Quality check", group: "Capture", blurb: "Density, coverage, gaps, outliers, classes" },
  { id: "ground", label: "Ground", group: "Model", blurb: "Classify bare earth (SMRF or CSF), flag noise" },
  { id: "surfaces", label: "Surfaces", group: "Model", blurb: "DTM, DSM, CHM, hillshade and void masks" },
  { id: "contours", label: "Contours", group: "Model", blurb: "Contours from the DTM, with index lines" },
  { id: "volume", label: "Stockpile volume", group: "Measure", blurb: "Volume above a base inside a polygon" },
  { id: "cutfill", label: "Cut / fill", group: "Measure", blurb: "Design surface against the ground" },
  { id: "change", label: "Change", group: "Measure", blurb: "DEM of difference against an earlier epoch" },
  { id: "accuracy", label: "Accuracy", group: "Measure", blurb: "ASPRS ed. 2 NVA/VVA against check points" },
  { id: "profile", label: "Profile", group: "Measure", blurb: "A section along a line drawn on the map" },
  { id: "report", label: "Report", group: "Deliver", blurb: "The printable, self-contained survey report" },
];

export const GROUPS: readonly StepGroup[] = ["Capture", "Model", "Measure", "Deliver"];

export type StepStatus = "done" | "ready" | "blocked";

export interface StepState {
  status: StepStatus;
  /** Why a blocked step cannot run yet, in words a surveyor acts on. */
  reason?: string;
}

const hasHeights = (s: JobSidecar): boolean => !!s.crs && (s.crs.height_reference ?? "none") !== "none";
const has = (s: JobSidecar, kind: string): boolean => !!s.products && kind in s.products;
const done = (s: JobSidecar, step: string): boolean => (s.steps_done ?? []).includes(step);

const NO_HEIGHTS =
  "The job has no vertical datum. Re-ingest with an assumed vertical datum (e.g. AHD, EPSG:5711) if you know it.";

/** Can `step` run on `sidecar` (null = the job does not exist yet)? */
export function stepState(step: StepDef["id"], sidecar: JobSidecar | null): StepState {
  if (sidecar === null) {
    return step === "ingest" ? { status: "ready" } : { status: "blocked", reason: "Ingest a point cloud first." };
  }
  const status: StepStatus = done(sidecar, step) ? "done" : "ready";
  const blocked = (reason: string): StepState => ({ status: done(sidecar, step) ? "done" : "blocked", reason });
  if (step === "ingest") return { status };
  if (!sidecar.crs || !has(sidecar, "copc")) return blocked("Ingest a point cloud first.");
  switch (step) {
    case "qa":
    case "ground":
      return { status };
    case "surfaces":
      if (!hasHeights(sidecar)) return blocked(NO_HEIGHTS);
      if (!has(sidecar, "classified")) return blocked("Classify ground first: the DTM is built from class 2.");
      return { status };
    case "contours":
    case "accuracy":
    case "profile":
    case "cutfill":
      if (!hasHeights(sidecar)) return blocked(NO_HEIGHTS);
      if (!has(sidecar, "dtm")) return blocked("Build the surfaces first (needs the DTM).");
      return { status };
    case "volume":
    case "change":
      if (!hasHeights(sidecar)) return blocked(NO_HEIGHTS);
      if (!sidecar.surfaces) return blocked("Build the surfaces first.");
      return { status };
    case "report":
      return { status };
  }
}

/** The first step that is ready and not done: where the guided flow suggests going next. */
export function nextStep(sidecar: JobSidecar | null): StepDef["id"] | null {
  for (const s of STEPS) {
    if (s.id === "volume" || s.id === "cutfill" || s.id === "change" || s.id === "profile") continue; // optional
    if (stepState(s.id, sidecar).status === "ready") return s.id;
  }
  return null;
}

/** Fraction of the core path (ingest → report) that is done, for the progress ring. */
export function coreProgress(sidecar: JobSidecar | null): number {
  const core = ["ingest", "qa", "ground", "surfaces", "contours", "accuracy", "report"];
  if (!sidecar) return 0;
  return core.filter((s) => done(sidecar, s)).length / core.length;
}
