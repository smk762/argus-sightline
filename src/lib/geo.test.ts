import { describe, expect, it } from "vitest";
import { closeRing, lineLength, ringArea } from "@/lib/geo";

describe("geo", () => {
  it("measures about 111 km per degree of latitude", () => {
    expect(lineLength([[115.86, -32], [115.86, -31]])).toBeCloseTo(111_195, -2);
  });

  it("finds the area of a ~100 m square near Perth to within 0.5 %", () => {
    const dLat = 100 / 111_195;
    const dLon = dLat / Math.cos((-31.95 * Math.PI) / 180);
    const ring: [number, number][] = [[115.86, -31.95], [115.86 + dLon, -31.95], [115.86 + dLon, -31.95 + dLat], [115.86, -31.95 + dLat]];
    expect(Math.abs(ringArea(ring) - 10_000) / 10_000).toBeLessThan(0.005);
    expect(closeRing(ring)).toHaveLength(5);
  });
});
