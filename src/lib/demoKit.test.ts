import { describe, expect, it } from "vitest";
import { findKit, KIT_TRUTH } from "@/lib/demoKit";

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
