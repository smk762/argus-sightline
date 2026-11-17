import { describe, expect, it } from "vitest";
import type { VolumeReport, ZoneVolume } from "@/lib/generated/survey";
import { latestVolume, stockpileTotal } from "@/lib/volumes";

const zone = (name: string, above: number): ZoneVolume => ({
  name,
  above_m3: above,
  below_m3: 0,
  net_m3: above,
  area_m2: 1,
  area_above_m2: 1,
  area_below_m2: 0,
  base: "plane",
  void_percent: 0,
});
const report = (kind: VolumeReport["kind"], zones: ZoneVolume[]): VolumeReport => ({
  kind,
  zones,
  method: "grid",
  res: 0.5,
  sign_convention: "",
  surface: "dsm",
  surface_void_percent: {},
});

describe("stockpileTotal", () => {
  it("sums every pile of the latest stockpile run", () => {
    const vols = [report("stockpile", [zone("old", 5)]), report("stockpile", [zone("north", 120), zone("south", 80)]), report("cutfill", [zone("pad", 9)])];
    expect(latestVolume(vols, "stockpile")?.zones.map((z) => z.name)).toEqual(["north", "south"]);
    expect(stockpileTotal(vols)).toBe(200);
  });

  it("is null without a stockpile run or with no zones", () => {
    expect(stockpileTotal(undefined)).toBeNull();
    expect(stockpileTotal([report("cutfill", [zone("pad", 9)])])).toBeNull();
    expect(stockpileTotal([report("stockpile", [])])).toBeNull();
  });
});
