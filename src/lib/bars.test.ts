import { describe, expect, it } from "vitest";
import { share } from "@/lib/bars";

describe("share", () => {
  it("is the clamped percentage of a positive whole", () => {
    expect(share(25, 100)).toBe(25);
    expect(share(0, 4)).toBe(0);
    expect(share(150, 100)).toBe(100);
    expect(share(-1, 100)).toBe(0);
  });

  it("is null, never NaN or Infinity, when the whole is zero", () => {
    // DensityBar on a cloud whose p95 density is 0; Timings whose every step took 0 s.
    expect(share(0, 0)).toBeNull();
    expect(share(3, 0)).toBeNull();
    expect(share(3, -1)).toBeNull();
    expect(share(3, Number.NaN)).toBeNull();
  });

  it("is null for a missing part", () => {
    expect(share(null, 10)).toBeNull();
    expect(share(undefined, 10)).toBeNull();
  });
});
