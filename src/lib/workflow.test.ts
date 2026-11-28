import { describe, expect, it } from "vitest";
import type { JobSidecar } from "@/lib/generated/survey";
import { coreProgress, ingestSections, nextStep, stepState } from "@/lib/workflow";

const crs = (height_reference: "gravity" | "none") => ({
  definition: "EPSG:7850+5711",
  name: "GDA2020 / MGA zone 50 + AHD height",
  horizontal: { name: "GDA2020 / MGA zone 50", kind: "ProjectedCRS", epsg: 7850 },
  height_reference,
});
const product = (kind: string) => ({ kind, path: kind, sha256: "0", size: 1, step: "x" });
const job = (over: Partial<JobSidecar> = {}): JobSidecar => ({ job_id: "j", package_version: "0", ...over });

describe("stepState", () => {
  it("offers only ingest for a job that does not exist", () => {
    expect(stepState("ingest", null).status).toBe("ready");
    expect(stepState("qa", null)).toMatchObject({ status: "blocked" });
  });

  it("refuses height-dependent steps without a vertical datum, as the server does", () => {
    const s = job({ crs: crs("none"), products: { copc: product("copc"), classified: product("classified") } });
    expect(stepState("qa", s).status).toBe("ready");
    expect(stepState("surfaces", s)).toMatchObject({ status: "blocked", reason: expect.stringContaining("vertical") });
  });

  it("walks the core path and keeps done steps done", () => {
    const s = job({
      crs: crs("gravity"),
      products: { copc: product("copc") },
      steps_done: ["ingest"],
    });
    expect(stepState("ingest", s).status).toBe("done");
    expect(stepState("surfaces", s).reason).toContain("ground");
    expect(nextStep(s)).toBe("qa");
    expect(coreProgress(s)).toBeCloseTo(1 / 7);
  });
});

// Audit pack-argus-sightline-1d01e6ad9c: a re-ingest sends the datums and pipeline settings, so it shows them.
describe("ingestSections", () => {
  it("shows the whole form before the first ingest", () => {
    expect(ingestSections(false, false)).toEqual({ points: true, settings: true });
  });

  it("hides the settings on an ingested job until Replace is ticked, then shows them", () => {
    expect(ingestSections(true, false)).toEqual({ points: false, settings: false });
    expect(ingestSections(true, true)).toEqual({ points: false, settings: true });
  });
});
