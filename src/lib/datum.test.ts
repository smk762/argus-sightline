import { describe, expect, it } from "vitest";
import { describeDatum } from "@/lib/datum";

const h = { name: "GDA2020 / MGA zone 50", kind: "ProjectedCRS", epsg: 7850 };

describe("describeDatum", () => {
  it("names a gravity datum and its geoid", () => {
    const d = describeDatum({
      definition: "EPSG:7850+5711",
      name: "x",
      horizontal: h,
      vertical: { name: "AHD height", kind: "VerticalCRS", epsg: 5711 },
      height_reference: "gravity",
      geoid: "au_ga_AUSGeoid2020_20180201.tif",
    });
    expect(d).toMatchObject({ status: "gravity", verticalCode: "EPSG:5711", horizontalCode: "EPSG:7850" });
    expect(d?.detail).toContain("AUSGeoid2020");
  });

  it("flags an assumed vertical datum, never hiding it", () => {
    const d = describeDatum({
      definition: "EPSG:7850+5711",
      name: "x",
      horizontal: h,
      vertical: { name: "AHD height", kind: "VerticalCRS", epsg: 5711 },
      height_reference: "gravity",
      vertical_assumed: "--assume-vertical EPSG:5711 (file had no vertical CRS)",
    });
    expect(d?.status).toBe("assumed");
    expect(d?.detail).toMatch(/ASSUMED/);
  });

  it("reports no datum at all", () => {
    expect(describeDatum({ definition: "EPSG:7850", name: "x", horizontal: h })?.status).toBe("none");
    expect(describeDatum(null)).toBeNull();
  });
});
