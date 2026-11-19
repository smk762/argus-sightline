import { describe, expect, it } from "vitest";
import type { CommandRecord, JobSidecar } from "@/lib/generated/survey";
import { madeWith, show, toolPackage } from "@/lib/provenance";

const cmd = (step: string, tool: string): CommandRecord => ({
  argv: [tool],
  returncode: 0,
  seconds: 0.1,
  started_at: "2026-11-13T00:00:00Z",
  step,
  tool,
});

/** Shaped like the demo recording's record-e1 job.json (trimmed). */
const sidecar = {
  job_id: "record-e1",
  package_version: "0.1.0rc2.dev20+g6ecae92d2",
  steps_done: ["ingest", "ground", "volume"],
  tools: { pdal: "2.10.2", gdal: "3.13.3", proj: "9.9.0" },
  commands: [
    cmd("ground", "pdal"),
    cmd("ground", "pdal"),
    cmd("ground", "untwine"),
    cmd("volume", "gdal"),
    cmd("volume", "ogr2ogr"),
    cmd("volume", "gdal_translate"),
  ],
  ground: {
    method: "smrf",
    params: { slope: 0.15, window: 18.0 },
    outlier_params: { method: "statistical", mean_k: 8 },
    tiles: 1,
  },
  volumes: [
    { kind: "cutfill", surface: "design (upper) vs DTM (lower)", res: 0.5, zones: [{ base: "DTM" }] },
    { kind: "stockpile", surface: "DSM (upper) vs base (lower)", res: 0.5, zones: [{ base: "least-squares plane" }] },
  ],
  products: {
    classified: { kind: "classified", path: "ground.copc.laz", step: "ground", sha256: "", size: 1 },
    volume: { kind: "volume", path: "volume.json", step: "volume", sha256: "", size: 1 },
  },
} as unknown as JobSidecar;

describe("madeWith", () => {
  it("is null until the step has run", () => {
    expect(madeWith(null, "ground")).toBeNull();
    expect(madeWith(sidecar, "surfaces")).toBeNull();
  });

  it("reads the version, the step's recorded params and its products from job.json", () => {
    const m = madeWith(sidecar, "ground")!;
    expect(m.version).toBe("0.1.0rc2.dev20+g6ecae92d2");
    expect(m.params).toContainEqual(["method", "smrf"]);
    expect(m.params).toContainEqual(["params", "slope=0.15 window=18"]);
    expect(m.products).toEqual(["ground.copc.laz"]);
  });

  it("takes the latest volume of the step's own kind", () => {
    const m = madeWith(sidecar, "volume")!;
    expect(m.params).toContainEqual(["surface", "DSM (upper) vs base (lower)"]);
    expect(m.params).toContainEqual(["base", "least-squares plane"]);
  });

  it("groups the step's commands by package, with the recorded versions", () => {
    expect(madeWith(sidecar, "ground")!.tools).toEqual(["PDAL 2.10.2 ×2", "untwine"]);
    expect(madeWith(sidecar, "volume")!.tools).toEqual(["GDAL 3.13.3 ×3"]);
  });
});

describe("show / toolPackage", () => {
  it("drops empty values and compacts objects", () => {
    expect(show(null)).toBeNull();
    expect(show("")).toBeNull();
    expect(show({ a: null })).toBeNull();
    expect(show({ k: 8, m: 3.0000001 })).toBe("k=8 m=3");
  });

  it("keeps projected coordinates whole, rounding only small parameters to 6 significant digits", () => {
    expect(show([512345.67, 5412345.67])).toBe("512345.67, 5412345.67");
    expect(show(0.15)).toBe("0.15");
    expect(show(0.000123456789)).toBe("0.000123457");
    expect(show(-1.5)).toBe("-1.5");
  });

  it("maps GDAL's and PROJ's binaries to their package", () => {
    expect(toolPackage("ogr2ogr")).toBe("gdal");
    expect(toolPackage("gdal_translate")).toBe("gdal");
    expect(toolPackage("projinfo")).toBe("proj");
    expect(toolPackage("untwine")).toBe("untwine");
  });
});
