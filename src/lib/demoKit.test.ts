import { describe, expect, it } from "vitest";
import { changeTruth, findKit, KIT_JOB_1, KIT_JOB_2, KIT_TRUTH, stockpileTruth, TRUTH_TOLERANCE } from "@/lib/demoKit";

describe("findKit", () => {
  it("finds a kit in a subdirectory and its companions", () => {
    const kit = findKit({
      points: ["kit/site-e1.laz", "kit/site-e2.laz", "other.laz"],
      vectors: ["kit/pad.geojson", "kit/stockpile.geojson", "kit/kit-truth.json"],
      rasters: ["kit/design.tif"],
      tables: ["kit/checks.csv"],
    });
    expect(kit).toMatchObject({ dir: "kit/", epoch2: "kit/site-e2.laz", design: "kit/design.tif", checks: "kit/checks.csv" });
  });

  it("returns null without one, and states the analytic truths", () => {
    expect(findKit({ points: ["a.laz"], vectors: [], rasters: [], tables: [] })).toBeNull();
    expect(KIT_TRUTH.stockpileVolume).toBeCloseTo(268.083, 3);
    expect(KIT_TRUTH.padNetCut).toBe(90);
  });
});

describe("stockpileTruth / changeTruth", () => {
  const kit = findKit({
    points: ["kit/site-e1.laz", "kit/site-e2.laz"],
    vectors: ["kit/stockpile.geojson", "kit/pad.geojson"],
    rasters: [],
    tables: [],
  });

  it("checks only the kit's stockpile zone, on a kit job", () => {
    expect(stockpileTruth(kit, KIT_JOB_1, "stockpile")).toEqual({ truth: KIT_TRUTH.stockpileVolume, tolerance: TRUTH_TOLERANCE["stockpile-e1"] });
    // A ring the user drew, or another feature of a picked file, is not the cone.
    expect(stockpileTruth(kit, KIT_JOB_1, "drawn polygon")).toBeNull();
    expect(stockpileTruth(kit, KIT_JOB_1, "pad")).toBeNull();
    expect(stockpileTruth(kit, "my-site", "stockpile")).toBeNull();
    expect(stockpileTruth(null, KIT_JOB_1, "stockpile")).toBeNull();
  });

  it("holds epoch 2 to its own cone and its own tolerance", () => {
    expect(stockpileTruth(kit, KIT_JOB_2, "stockpile")).toEqual({ truth: KIT_TRUTH.stockpileVolumeE2, tolerance: TRUTH_TOLERANCE["stockpile-e2"] });
  });

  it("checks change only for epoch 2 against epoch 1, in the stockpile polygon, with no LoD", () => {
    const base = { against_job: KIT_JOB_1, area: "stockpile", lod_m: 0 };
    expect(changeTruth(kit, KIT_JOB_2, base)).toEqual({ truth: KIT_TRUTH.changeGain, tolerance: TRUTH_TOLERANCE["change-gain"] });
    expect(changeTruth(kit, KIT_JOB_2, { ...base, area: "pad" })).toBeNull();
    expect(changeTruth(kit, KIT_JOB_2, { ...base, area: "whole overlap of the two epochs" })).toBeNull();
    expect(changeTruth(kit, KIT_JOB_2, { ...base, against_job: "some-other-job" })).toBeNull();
    expect(changeTruth(kit, KIT_JOB_2, { ...base, lod_m: 0.1 })).toBeNull();
    expect(changeTruth(kit, KIT_JOB_1, base)).toBeNull();
  });
});
