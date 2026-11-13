/**
 * "Made with": which argus-survey version computed a step, with which
 * parameters and which external tools. Read from `job.json` (the step's own
 * report plus the command log), never hard-coded, so it says what the server
 * actually did on this job.
 */

import type { CrsRecord, JobSidecar, VolumeReport } from "@/lib/generated/survey";
import type { StepDef } from "@/lib/workflow";

export interface MadeWith {
  /** argus-survey's version, from the sidecar. */
  version: string;
  step: StepDef["id"];
  /** The parameters the step recorded, in the order a surveyor reads them. */
  params: [string, string][];
  /** External tools the step ran, by package, with versions where the job recorded them: "PDAL 2.10.2 ×3". */
  tools: string[];
  /** Product files the step wrote. */
  products: string[];
}

const crsName = (c: CrsRecord | null | undefined): string | null =>
  c ? [c.name, c.vertical_assumed ? `(vertical ASSUMED: ${c.vertical_assumed})` : null].filter(Boolean).join(" ") : null;

/** A value as one short string; objects compactly, so `{slope: 0.15}` reads as `slope=0.15`. */
export function show(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(6)));
  if (typeof value === "string" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(show).filter(Boolean).join(", ") || null;
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([k, v]) => [k, show(v)] as const)
    .filter(([, v]) => v !== null);
  return entries.length ? entries.map(([k, v]) => `${k}=${v}`).join(" ") : null;
}

const lastOf = (volumes: VolumeReport[] | undefined, kind: VolumeReport["kind"]): VolumeReport | undefined =>
  (volumes ?? []).filter((v) => v.kind === kind).at(-1);

function rawParams(s: JobSidecar, step: StepDef["id"]): [string, unknown][] {
  switch (step) {
    case "ingest":
      return [
        ["source CRS", crsName(s.ingest?.source_crs)],
        ["job CRS", crsName(s.crs) === crsName(s.ingest?.source_crs) ? null : crsName(s.crs)],
        ["operation", s.ingest?.transform?.name],
        ["crop", s.ingest?.crop],
      ];
    case "qa":
      return [
        ["outliers", s.qa?.outliers.method],
        ["outlier params", s.qa?.outliers.params],
      ];
    case "ground":
      return [
        ["method", s.ground?.method],
        ["params", s.ground?.params],
        ["outlier params", s.ground?.outlier_params],
        ["tiles", s.ground?.tiles],
      ];
    case "surfaces": {
      const surfaces = Object.entries(s.surfaces?.surfaces ?? {});
      return [
        ["res", s.surfaces ? `${show(s.surfaces.grid.res)} m` : null],
        ...surfaces.map(([name, r]) => [name, r.method] as [string, string]),
      ];
    }
    case "contours":
      return [
        ["source", s.contours?.source],
        ["interval", s.contours ? `${show(s.contours.interval)} m` : null],
        ["index every", s.contours?.index_every],
      ];
    case "volume":
    case "cutfill": {
      const v = lastOf(s.volumes, step === "volume" ? "stockpile" : "cutfill");
      return [
        ["surface", v?.surface],
        ["base", v?.zones.map((z) => z.base)],
        ["res", v ? `${show(v.res)} m` : null],
        ["resampled", v?.resampled],
      ];
    }
    case "change":
      return [
        ["against", s.change?.against_job],
        ["surface", s.change?.surface],
        ["LoD", s.change?.lod_rule],
        ["res", s.change ? `${show(s.change.res)} m` : null],
      ];
    case "accuracy":
      return [
        ["standard", s.accuracy?.standard],
        ["surface", s.accuracy?.surface],
        ["sampling", s.accuracy?.sampling],
        ["check CRS", s.accuracy?.checks_crs],
      ];
    case "profile": {
      const p = s.profiles?.at(-1);
      return [
        ["step", p ? `${show(p.step_m)} m` : null],
        ["surfaces", p?.surfaces],
      ];
    }
    case "report":
      return [];
  }
}

/** The package a command belongs to: `gdal_translate` and `ogr2ogr` are GDAL, `projinfo` is PROJ. */
export function toolPackage(tool: string): string {
  const t = tool.toLowerCase();
  if (/^(gdal|ogr)/.test(t)) return "gdal";
  if (t.startsWith("proj")) return "proj";
  if (t.startsWith("pdal")) return "pdal";
  return t;
}

/** "GDAL 3.13.3 ×12": the step's commands grouped by package, with versions where the job recorded them. */
function tools(s: JobSidecar, step: string): string[] {
  const counts = new Map<string, number>();
  for (const c of s.commands ?? []) {
    if (c.step !== step) continue;
    const pkg = toolPackage(c.tool);
    counts.set(pkg, (counts.get(pkg) ?? 0) + 1);
  }
  const versions = (s.tools ?? {}) as Record<string, string | null | undefined>;
  return [...counts]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([pkg, n]) => {
      const name = pkg in versions ? pkg.toUpperCase() : pkg;
      const v = versions[pkg];
      return `${name}${v ? ` ${v}` : ""}${n > 1 ? ` ×${n}` : ""}`;
    });
}

/** What computed `step` on this job, or null if the step hasn't run. */
export function madeWith(s: JobSidecar | null, step: StepDef["id"]): MadeWith | null {
  if (!s || !(s.steps_done ?? []).includes(step)) return null;
  const params = rawParams(s, step)
    .map(([k, v]) => [k, show(v)] as const)
    .filter((kv): kv is [string, string] => kv[1] !== null);
  const products = Object.values(s.products ?? {})
    .filter((p) => p.step === step)
    .map((p) => p.path.split("/").at(-1) ?? p.path)
    .sort();
  return { version: s.package_version, step, params, tools: tools(s, step), products };
}
